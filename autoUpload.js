// This script is designed to be run in a Node.js environment.
// It will read PDF files from a local directory, parse the text,
// split the text into individual questions, and upload the extracted
// question data to a Firestore database.
//
// You will need to install two packages:
// `npm install firebase-admin`
// `npm install pdf-parse`

// Import necessary modules
const admin = require('firebase-admin');
const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

// IMPORTANT: Replace this with the path to your downloaded service account key JSON file.
// This file is required for the script to authenticate with your Firebase project.
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
  process.exit(1); // Exit if initialization fails
}

const db = admin.firestore();

// Define the name of your Firestore collection
const collectionName = 'questions';

// The directory where your PDF files are located.
// Make sure this folder exists in the same directory as this script.
const pdfsDir = './pdfs';

/**
 * Extracts a specific section of text between two keywords.
 * This is a highly robust helper function to handle inconsistent formatting
 * and variations in keyword spelling or case.
 *
 * @param {string} text - The full text block to search within.
 * @param {string} startKeyword - The keyword that marks the beginning of the section.
 * @param {string[]} endKeywords - An array of keywords that could mark the end.
 * @returns {string} The extracted text, or an empty string if not found.
 */
const extractSection = (text, startKeyword, endKeywords) => {
  const startIndex = text.indexOf(startKeyword);
  if (startIndex === -1) {
    return '';
  }

  const startPosition = startIndex + startKeyword.length;
  let endIndex = text.length;

  for (const keyword of endKeywords) {
    const nextIndex = text.indexOf(keyword, startPosition);
    if (nextIndex !== -1 && nextIndex < endIndex) {
      endIndex = nextIndex;
    }
  }

  let extractedText = text.substring(startPosition, endIndex).trim();
  // Clean up extra whitespace and line breaks for a cleaner string
  extractedText = extractedText.replace(/\s+/g, ' ');
  return extractedText;
};

/**
 * Parses the text from a single question block and extracts all data fields.
 *
 * @param {string} text - The raw text of a single question block.
 * @returns {object} The structured question data.
 */
const parseSingleQuestionText = (text) => {
  // Regex patterns to find different parts of the question.
  const idRegex = /Question ID\s*([a-f0-9]+)/;
  const idMatch = text.match(idRegex);
  const id = idMatch ? idMatch[1].trim() : null;

  // Extract the main question content (passage and prompt)
  let questionBody = text.replace(/Question ID\s*[a-f0-9]+/, '').trim();
  // Remove the duplicate ID line that appears in the body
  questionBody = questionBody.replace(new RegExp(`ID:\\s*${id}\\s*`), '').trim();
  questionBody = questionBody.replace(new RegExp(`ID:\\s*${id}\\s*Answer`), '').trim();


  // Find the location of the options to separate passage and prompt.
  const optionsStartRegex = /\s*([A-D]\.[\s\S]+)/;
  const optionsStartMatch = questionBody.match(optionsStartRegex);
  const optionsStartIndex = optionsStartMatch ? optionsStartMatch.index : -1;

  let passage = '';
  let promptText = '';

  if (optionsStartIndex !== -1) {
    const preOptionsText = questionBody.substring(0, optionsStartIndex).trim();
    const lines = preOptionsText.split(/\r?\n/);
    promptText = lines.pop().trim();
    passage = lines.join('\n').trim();
  } else {
    // If no options are found, the whole thing is the passage/prompt.
    passage = questionBody;
    promptText = '';
  }

  // Regex to extract options from the full text
  const optionsRegex = /([A-D]\.[\s\S]+?)(?=\s*ID:)/;
  const optionsMatch = text.match(optionsRegex);
  const optionsRaw = optionsMatch ? optionsMatch[1].trim() : '';
  const optionLines = optionsRaw.split(/\r?\n(?=[A-D]\.)/);
  const options = optionLines.map(line => {
    const [value, ...rest] = line.trim().split('.');
    return { value: value.trim(), text: `${value.trim()}. ${rest.join('.').trim()}` };
  });

  const correctAnswerRegex = /Correct Answer:\s*([A-D])/;
  const correctAnswerMatch = text.match(correctAnswerRegex);
  
  // Use the robust `extractSection` helper function
  // const rationale = extractSection(text, 'Rationale', ['Question Difficulty', 'Question Dif culty', 'Question Difficulty:', 'Question Difculty', 'Question Dif culty:', 'Question Difculty:', 'Question Dif', 'Assessment']);

  const rationale = extractSection(text, 'Rationale', ['Question Difficulty', 'Question Dif', 'Assessment']);

  let difficulty = extractSection(text, 'Question Difficulty', ['Assessment', 'Test', 'Domain']);

  if (difficulty === '') {
    // Fallback for the typo
    difficulty = extractSection(text, 'culty:', ['Assessment', 'Test', 'Domain']);
  }

  // Regex patterns for the metadata at the end of the block
  const testRegex = /Test\s*([\s\S]+?)\s*Domain/;
  const domainRegex = /Domain\s*([\s\S]+?)\s*Skill/;
  const skillRegex = /Skill\s*([\s\S]+?)\s*Difficulty/;
  
  const testMatch = text.match(testRegex);
  const domainMatch = text.match(domainRegex);
  const skillMatch = text.match(skillRegex);
  
  // Create the final object
  return {
    id: id,
    test: testMatch ? testMatch[1].trim().replace(/\s+/g, ' ') : 'Unknown',
    domain: domainMatch ? domainMatch[1].trim().replace(/\s+/g, ' ') : 'Unknown',
    skill: skillMatch ? skillMatch[1].trim().replace(/\s+/g, ' ') : 'Unknown',
    difficulty: difficulty,
    passage: passage,
    prompt: promptText,
    options: options.filter(o => o.value),
    correctAnswer: correctAnswerMatch ? correctAnswerMatch[1].trim() : '',
    rationale: rationale,
  };
};

/**
 * The main asynchronous function to read files and upload data.
 */
const uploadQuestionsFromPdfs = async () => {
  console.log("Starting automated PDF parsing and upload...");

  // Check if the directory exists
  if (!fs.existsSync(pdfsDir)) {
    console.error(`Error: The directory '${pdfsDir}' does not exist.`);
    console.error("Please create a 'pdfs' folder and place your PDF files inside it.");
    return;
  }

  // Get all file names in the directory
  const files = fs.readdirSync(pdfsDir);
  const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

  if (pdfFiles.length === 0) {
    console.warn("No PDF files found in the 'pdfs' directory. Aborting.");
    return;
  }

  const questionsToUpload = [];

  for (const file of pdfFiles) {
    const filePath = path.join(pdfsDir, file);
    const dataBuffer = fs.readFileSync(filePath);

    try {
      const data = await pdf(dataBuffer);
      const rawText = data.text;
      
      // Use a regex to split the text into individual question blocks.
      const questionBlocks = rawText.split(/Question ID\s*([a-f0-9]+)/);

      // The first element will be everything before the first ID, which we can ignore.
      const validQuestionBlocks = questionBlocks.slice(1);

      if (validQuestionBlocks.length > 0) {
        // Iterate through the question blocks, including the ID in the text for parsing
        for (let i = 0; i < validQuestionBlocks.length; i += 2) {
          const id = validQuestionBlocks[i];
          const blockText = validQuestionBlocks[i + 1];

          if (blockText) {
            const question = parseSingleQuestionText(`Question ID ${id}\n${blockText}`);
            if (question.id) {
              questionsToUpload.push(question);
              console.log(`Successfully parsed question ID: ${question.id}`);
            } else {
              console.warn(`Could not parse a question block in file: ${file}. It may have an unexpected format.`);
            }
          }
        }
        console.log(`Successfully parsed and extracted ${questionsToUpload.length} questions from: ${file}`);
      } else {
        console.warn(`Could not split file: ${file} into question blocks. It may have an unexpected format.`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  if (questionsToUpload.length === 0) {
    console.warn("No questions were successfully parsed. No data will be uploaded.");
    return;
  }

  // Upload the parsed questions to Firestore
  console.log(`Starting to upload ${questionsToUpload.length} questions to Firestore...`);
  const batch = db.batch();
  const collectionRef = db.collection(collectionName);

  questionsToUpload.forEach((question) => {
    if (question.id) {
      const docRef = collectionRef.doc(question.id);
      batch.set(docRef, question);
    }
  });

  try {
    await batch.commit();
    console.log('Successfully uploaded all questions!');
  } catch (error) {
    console.error('Error uploading questions:', error);
  }
};

uploadQuestionsFromPdfs();
