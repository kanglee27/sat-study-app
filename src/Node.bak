// This script is designed to be run in a Node.js environment.
// It populates a Firestore collection with question data.
// You will need to install the Firebase Admin SDK: `npm install firebase-admin`

// Import the Firebase Admin SDK
const admin = require('firebase-admin');

// IMPORTANT: Replace this with the path to your downloaded service account key JSON file.
// This file is required for the script to authenticate with your Firebase project.
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Define the name of your Firestore collection
const collectionName = 'questions';

// This is the data structure for a single question document.
// You would populate this array with the extracted data from your PDF files.
// The example data below is from the 'Central Ideas and Details 1~Key.pdf' snippet.
const questionsToUpload = [
  {
    "id": "57485f5e",
    "domain": "Reading and Writing",
    "skill": "Information and Ideas",
    "difficulty": "Easy",
    "passage": "The following text is adapted from Johanna Spyri's 1881 novel Heidi (translated by Elisabeth Stork in 1915). Eight-year-old Heidi and her friend's grandmother are looking at some illustrated books.\n\nHeidi had come and was looking with wondering eyes at the splendid pictures in the large books, that Grandmama was showing her. Suddenly she screamed aloud, for there on the picture she saw a peaceful flock grazing on a green pasture. In the middle a shepherd was standing, leaning on his crook. The setting sun was shedding a golden light over everything. With glowing eyes Heidi devoured the scene.",
    "prompt": "Which choice best states the main idea of the text?",
    "options": [
      { "text": "A. Heidi is upset until she sees a serene image of a pasture in one of Grandmama's books.", "value": "A" },
      { "text": "B. Heidi is delighted and fascinated by an image she sees in one of Grandmama's books.", "value": "B" },
      { "text": "C. Heidi is initially frightened by an image in one of Grandmama's books but quickly comes to appreciate its beauty.", "value": "C" },
      { "text": "D. Heidi is inspecting an image in one of Grandmama's books because she has never seen a shepherd with his sheep before.", "value": "D" }
    ],
    "correctAnswer": "B",
    "rationale": "Choice B is the best answer because it most effectively states the main idea of the text, which is that Heidi is delighted and fascinated by an image she sees in one of Grandmama's books. The text states that Heidi looked with 'wondering eyes' and that she 'screamed aloud' and 'devoured the scene' with 'glowing eyes.' These words and phrases indicate that Heidi is delighted and fascinated. The other options are not supported by the text."
  }
];

// Asynchronous function to upload all questions to Firestore
const uploadQuestions = async () => {
  console.log(`Starting to upload ${questionsToUpload.length} questions to Firestore...`);

  const batch = db.batch();
  
  questionsToUpload.forEach((question) => {
    // Create a document reference with the ID from the data
    const docRef = db.collection(collectionName).doc(question.id);
    batch.set(docRef, question);
  });

  try {
    await batch.commit();
    console.log('Successfully uploaded all questions!');
  } catch (error) {
    console.error('Error uploading questions:', error);
  }
};

// Execute the upload function
uploadQuestions();
