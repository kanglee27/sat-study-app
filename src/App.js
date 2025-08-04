import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

// --- IMPORTANT: REPLACE THIS WITH YOUR OWN FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCtbHZq41epbAOKe4r-GKPCRQOUjRvA88w",
  authDomain: "sat-study-app-3cdfa.firebaseapp.com",
  projectId: "sat-study-app-3cdfa",
  storageBucket: "sat-study-app-3cdfa.firebasestorage.app",
  messagingSenderId: "567413427184",
  appId: "1:567413427184:web:1029e48258556206c56b35",
  measurementId: "G-SBRGCFL2NR"
};

// Replace with a static name for your Firestore collection.
const questionsCollectionName = 'questions';

/**
 * Safely formats a string to include underlines based on <u> tags.
 * This prevents the use of dangerouslySetInnerHTML and instead
 * generates a list of React elements.
 * @param {string} text The string to parse and format.
 * @returns {Array<React.Element>} An array of React elements.
 */
const formatTextWithUnderlines = (text) => {
  // Use a regular expression to find all text inside <u>...</u> tags
  // The 'g' flag ensures all occurrences are matched
  const parts = text.split(/(<u>[^<]+<\/u>)/g);
  return parts.map((part, index) => {
    // Check if the part starts with <u> and ends with </u>
    if (part.startsWith('<u>') && part.endsWith('</u>')) {
      // Extract the text within the tags
      const content = part.substring(3, part.length - 4);
      // Return a span with the underline class
      return (
        <span key={index} className="underline">
          {content}
        </span>
      );
    }
    // For all other parts, return a regular span
    return <span key={index}>{part}</span>;
  });
};

/**
 * Renders a string into a combination of paragraphs and bulleted lists.
 * This function now only recognizes '*' as a bullet point marker.
 * It also applies the underline formatting to the text.
 * @param {string} text The string to parse, which may contain newlines and bullet markers.
 * @returns {Array<React.Element>} An array of React elements (p, ul, li).
 */
const renderContent = (text) => {
  const lines = text.split('\n');
  const elements = [];
  let currentList = [];

  // Helper function to flush the current list into the elements array
  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        // Add a padding-left class for indentation
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 pl-4">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    // Only check for the asterisk marker
    const isBullet = line.trim().startsWith('* ');

    if (isBullet) {
      // If it's a bullet, add it to the current list
      const content = line.trim().substring(2);
      currentList.push(
        <li key={`li-${index}`}>{formatTextWithUnderlines(content)}</li>
      );
    } else {
      // If it's not a bullet, flush any existing list and add a new paragraph
      flushList();
      // Create paragraph for both empty and non-empty lines
      // For empty lines, we'll add a non-breaking space to maintain spacing
      const content = line.trim().length > 0 ? line : '\u00A0'; // \u00A0 is a non-breaking space
      elements.push(
        <p key={`p-${index}`} className="whitespace-pre-line">
          {formatTextWithUnderlines(content)}
        </p>
      );
    }
  });

  // Flush any remaining list items at the end of the text
  flushList();

  return elements;
};

function App() {
  // --- State management for the app ---
  const [appState, setAppState] = useState('menu'); // 'menu', 'test', 'results'
  const [allQuestions, setAllQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState(null);
  const [message, setMessage] = useState(null);
  const [showRationale, setShowRationale] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState({});

  // --- Firebase Initialization and Data Fetching ---
  useEffect(() => {
    let app, db, auth;
    let unsubscribeAuth = () => {};
    let unsubscribeFirestore = () => {};

    try {
      if (Object.keys(firebaseConfig).length === 0) {
        setError("Please add your Firebase configuration to the firebaseConfig object.");
        setIsLoading(false);
        return;
      }
      
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);
      console.log("Firebase initialized successfully.");

      const setupFirebase = async () => {
        try {
          console.log("Setting up Firebase auth...");
          await signInAnonymously(auth);
          
          unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
              setUserId(user.uid);
              console.log("Firebase Auth State Changed. User ID:", user.uid);
              
              console.log("Setting up Firestore listener for questions...");
              const q = collection(db, questionsCollectionName);
              unsubscribeFirestore = onSnapshot(q, (querySnapshot) => {
                const fetchedQuestions = [];
                querySnapshot.forEach((doc) => {
                  fetchedQuestions.push({ id: doc.id, ...doc.data() });
                });
                setAllQuestions(fetchedQuestions);
                setIsLoading(false);
                console.log("Fetched questions:", fetchedQuestions);
              }, (err) => {
                console.error("Error fetching documents: ", err);
                setError("Failed to load questions. Please check your Firestore setup and security rules.");
                setIsLoading(false);
              });
            } else {
              console.warn("User is not authenticated. Questions will not be fetched.");
              setError("Authentication failed. Ensure Anonymous sign-in is enabled in your Firebase console.");
              setIsLoading(false);
            }
          });
        } catch (e) {
              console.error("Error during Firebase authentication:", e);
              setError("Failed to authenticate. Check your config and that Anonymous sign-in is enabled.");
              setIsLoading(false);
        }
      };
      setupFirebase();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setError("Failed to initialize Firebase. Please check your project configuration.");
      setIsLoading(false);
    }
    
    // Cleanup function to unsubscribe listeners when the component unmounts
    return () => {
      unsubscribeAuth();
      unsubscribeFirestore();
    };
  }, []);

  // --- UI Interaction Logic ---
  const handleTopicSelection = (subject, subcategories) => {
    setSelectedSubcategories(prevSubcategories => {
      // If the main topic is already partially or fully selected, deselect all its subcategories
      const allSelected = subcategories.every(sub => prevSubcategories.includes(sub));
      if (allSelected) {
        return prevSubcategories.filter(sub => !subcategories.includes(sub));
      } else {
        // Otherwise, add all subcategories that aren't already selected
        const newSubcategories = subcategories.filter(sub => !prevSubcategories.includes(sub));
        return [...prevSubcategories, ...newSubcategories];
      }
    });
  };
  
  const handleSubcategorySelection = (subcategory) => {
    setSelectedSubcategories(prevSubcategories =>
      prevSubcategories.includes(subcategory)
        ? prevSubcategories.filter(s => s !== subcategory)
        : [...prevSubcategories, subcategory]
    );
  };
  
  const handleDifficultySelection = (difficulty) => {
    setSelectedDifficulty(prevDifficulty =>
      prevDifficulty.includes(difficulty)
        ? prevDifficulty.filter(d => d !== difficulty)
        : [...prevDifficulty, difficulty]
    );
  };
  
  const toggleTopicExpand = (topic) => {
    setExpandedTopics(prevExpanded => ({
      ...prevExpanded,
      [topic]: !prevExpanded[topic],
    }));
  };

  const handleStartTest = () => {
    if (selectedSubcategories.length === 0 && selectedDifficulty.length === 0) {
      setMessage("Please select at least one sub-category or a difficulty level to start the test.");
      return;
    }

    const newFilteredQuestions = allQuestions.filter(q => {
      const subcategoryMatch = selectedSubcategories.length === 0 || selectedSubcategories.includes(q.skill);
      const difficultyMatch = selectedDifficulty.length === 0 || selectedDifficulty.includes(q.difficulty);
      
      return subcategoryMatch && difficultyMatch;
    });

    if (newFilteredQuestions.length === 0) {
      setMessage("No questions found for the selected criteria. Please try a different combination.");
      return;
    }

    setFilteredQuestions(newFilteredQuestions);
    setAnswers(
      newFilteredQuestions.map(q => ({
        id: q.id,
        userAnswer: null,
      }))
    );
    setCurrentQuestionIndex(0);
    setShowRationale(false);
    setSelectedOption(null);
    setAppState('test');
    setMessage(null);
  };

  const handleBackToMenu = () => {
    // Reset all state to return to the initial menu screen
    setAppState('menu');
    setAnswers([]);
    setFilteredQuestions([]);
    setSelectedSubcategories([]);
    setSelectedDifficulty([]);
    setCurrentQuestionIndex(0);
    setMessage(null);
    setSelectedOption(null);
    setShowRationale(false);
  };

  const handleSelectAnswer = (value) => {
    // Only allow selection if the answer hasn't been submitted yet
    if (answers[currentQuestionIndex].userAnswer === null) {
      setSelectedOption(value);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedOption !== null) {
      const newAnswers = [...answers];
      newAnswers[currentQuestionIndex] = { ...newAnswers[currentQuestionIndex], userAnswer: selectedOption };
      setAnswers(newAnswers);
      setShowRationale(true);
    }
  };

  const handleNext = () => {
    const newIndex = currentQuestionIndex + 1;
    if (newIndex < filteredQuestions.length) {
      setCurrentQuestionIndex(newIndex);
      // Restore state for the new question
      const nextAnswerState = answers[newIndex];
      setShowRationale(nextAnswerState.userAnswer !== null);
      setSelectedOption(nextAnswerState.userAnswer || null);
    } else {
      setAppState('results');
    }
  };

  const handleBack = () => {
    const newIndex = currentQuestionIndex - 1;
    if (newIndex >= 0) {
      setCurrentQuestionIndex(newIndex);
      // Restore state for the previous question
      const prevAnswerState = answers[newIndex];
      setShowRationale(prevAnswerState.userAnswer !== null);
      setSelectedOption(prevAnswerState.userAnswer || null);
    } else {
      handleBackToMenu();
    }
  };
  
  const handleDropdownChange = (e) => {
      const newIndex = parseInt(e.target.value, 10);
      setCurrentQuestionIndex(newIndex);
      // Restore state for the selected question
      const selectedAnswerState = answers[newIndex];
      setShowRationale(selectedAnswerState.userAnswer !== null); // Show rationale if already answered
      setSelectedOption(selectedAnswerState.userAnswer || null); // Restore selected answer
  };

  const topics = {
    'Reading and Writing': [
      { name: 'Craft and Structure', subcategories: ["Cross-Text Connections", "Text Structure and Purpose", "Words in Context"] },
      { name: 'Expression of Ideas', subcategories: ["Rhetorical Synthesis", "Transitions"] },
      { name: 'Information and Ideas', subcategories: ["Central Ideas and Details", "Command of Evidence", "Inferences"] },
      { name: 'Standard English Conventions', subcategories: ["Boundaries", "Form, Structure, and Sense"] }
    ],
    'Math': [
      { name: 'Algebra', subcategories: ['Linear Equations in One Variable', 'Linear Equations in Two Variables', 'Linear Functions', 'Systems of Two Linear Equations in Two Variables'] },
      { name: 'Problem Solving and Data Analysis', subcategories: ['Ratios, Rates, Proportional Relationships, and Units', 'Percentages', 'Table Data', 'Probability and Conditional Probability', 'Data Inferences', 'Evaluating Statistical Claims', 'Scatterplots', 'Linear and Exponential Growth'] },
      { name: 'Advanced Math', subcategories: ['Equivalent Expressions', 'Nonlinear Equations in One Variable and Systems of Equations in Two Variables', 'Nonlinear Functions', 'Function Notation', 'Radicals and Rational Exponents'] },
      { name: 'Geometry and Trigonometry', subcategories: ['Area and Volume', 'Lines, Angles, and Triangles', 'Right Triangles and Trigonometry', 'Circles'] }
    ]
  };
  
  const difficulties = ["Easy", "Medium", "Hard"];

  const getTopicButtonClass = (subcategories) => {
    const allSelected = subcategories.every(sub => selectedSubcategories.includes(sub));
    return allSelected ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100';
  };

  const getSubcategoryButtonClass = (subcategory) => {
    return selectedSubcategories.includes(subcategory) ? 'bg-purple-500 text-white border-purple-500 shadow-md' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100';
  };
  
  // Helper functions for rendering
  const getOptionButtonClass = (optionValue) => {
    const currentAnswerState = answers[currentQuestionIndex];
    if (currentAnswerState.userAnswer !== null) {
      if (optionValue === filteredQuestions[currentQuestionIndex].correctAnswer) {
        return 'bg-green-500 text-white border-green-500 shadow-md';
      }
      if (optionValue === currentAnswerState.userAnswer) {
        return 'bg-red-500 text-white border-red-500 shadow-md';
      }
      return 'bg-white text-gray-800 border-gray-300';
    }
    return selectedOption === optionValue
      ? 'bg-blue-500 text-white border-blue-500 shadow-md'
      : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50';
  };

  // --- Conditional Rendering of the App ---
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-xl text-gray-700 animate-pulse">Loading questions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-red-100 p-4">
        <div className="text-xl text-red-700 font-semibold">{error}</div>
      </div>
    );
  }

  // Render the Menu UI
  if (appState === 'menu') {
    return (
      <div className="bg-gray-100 min-h-screen font-sans antialiased text-gray-800 flex items-center justify-center relative">
        {message && (
          <div className="absolute top-0 w-full flex justify-center mt-4 z-50">
            <div className="bg-white p-4 rounded-lg shadow-xl border-l-4 border-blue-500 text-gray-700 max-w-sm w-full">
              <div className="flex justify-between items-center">
                <span>{message}</span>
                <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="w-full max-w-4xl bg-white p-8 rounded-2xl shadow-lg">
          <h1 className="text-3xl font-bold text-center mb-6">SAT Suite Question Bank</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {Object.keys(topics).map(subject => (
              <div key={subject} className="bg-gray-50 p-6 rounded-lg shadow-inner">
                <button
                  onClick={() => handleTopicSelection(subject, topics[subject].flatMap(t => t.subcategories))}
                  className={`
                    w-full text-left p-3 rounded-lg border-2 font-bold transition-colors duration-200 mb-4
                    ${getTopicButtonClass(topics[subject].flatMap(t => t.subcategories))}
                  `}
                >
                  {subject}
                </button>
                <div className="space-y-3">
                  {topics[subject].map(topic => (
                    <div key={topic.name}>
                       <button
                         onClick={(e) => { e.stopPropagation(); toggleTopicExpand(topic.name); }}
                         className={`
                           w-full text-left p-3 rounded-lg border-2 transition-colors duration-200 flex justify-between items-center
                           ${getTopicButtonClass(topic.subcategories)}
                         `}
                       >
                         {topic.name}
                         <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform ${expandedTopics[topic.name] ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                         </svg>
                       </button>
                       {expandedTopics[topic.name] && (
                          <div className="ml-4 mt-2 space-y-2">
                             {topic.subcategories.map(subcategory => (
                                <button
                                   key={subcategory}
                                   onClick={() => handleSubcategorySelection(subcategory)}
                                   className={`
                                      w-full text-left p-2 pl-4 rounded-lg border-2 transition-colors duration-200
                                      ${getSubcategoryButtonClass(subcategory)}
                                   `}
                                >
                                   {subcategory}
                                </button>
                             ))}
                          </div>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8">
            <h2 className="text-xl font-semibold mb-4 text-center">Difficulty Level</h2>
            <div className="flex justify-center space-x-4">
              {difficulties.map(difficulty => (
                <button
                  key={difficulty}
                  onClick={() => handleDifficultySelection(difficulty)}
                  className={`
                    px-6 py-2 rounded-lg border-2 font-semibold transition-colors duration-200
                    ${selectedDifficulty.includes(difficulty) ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}
                  `}
                >
                  {difficulty}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-center space-x-4">
            <button
              onClick={handleBackToMenu}
              className="bg-gray-200 text-gray-700 px-8 py-3 rounded-lg font-bold shadow-sm hover:bg-gray-300"
            >
              Back
            </button>
            <button
              onClick={handleStartTest}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedSubcategories.length === 0 && selectedDifficulty.length === 0}
            >
              Start Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render the Test UI if the appState is 'test'
  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === filteredQuestions.length - 1;
  const currentAnswerState = answers[currentQuestionIndex];
  
  if (appState === 'test' && currentQuestion) {
    return (
      <div className="bg-gray-100 min-h-screen font-sans antialiased text-gray-800 relative">
        {message && (
          <div className="absolute top-0 w-full flex justify-center mt-4 z-50">
            <div className="bg-white p-4 rounded-lg shadow-xl border-l-4 border-blue-500 text-gray-700 max-w-sm w-full">
              <div className="flex justify-between items-center">
                <span>{message}</span>
                <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="flex justify-between items-center bg-white p-4 rounded-t-2xl shadow-sm">
            <div className="flex flex-col space-y-1">
              <span className="text-xs text-gray-500 uppercase font-medium">Domain:</span>
              <span className="font-semibold text-sm">{currentQuestion.domain}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-xs text-gray-500 uppercase font-medium">Skill:</span>
              <span className="font-semibold text-sm">{currentQuestion.skill}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-xs text-gray-500 uppercase font-medium">Difficulty:</span>
              <span className="font-semibold text-sm">{currentQuestion.difficulty}</span>
            </div>
          </header>

          <main className="bg-white p-6 rounded-b-2xl shadow-lg border-t-2 border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="col-span-1 border-r border-gray-200 pr-8">
              <h2 className="text-sm font-semibold mb-2">Passage</h2>
              <div className="prose prose-sm max-w-none text-gray-700">
                {/* Use the new renderContent function to handle both paragraphs and lists */}
                {renderContent(currentQuestion.passage)}
              </div>
            </section>

            <section className="col-span-1 pl-8">
              <div>
                <p className="text-md text-gray-800 font-medium mb-4">
                  {currentQuestion.prompt}
                </p>
                <div className="space-y-3">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.value}
                      className={`
                        w-full text-left p-3 rounded-lg border-2 transition-all duration-200
                        ${getOptionButtonClass(option.value)}
                        ${currentAnswerState.userAnswer !== null && 'cursor-not-allowed'}
                      `}
                      onClick={() => handleSelectAnswer(option.value)}
                      disabled={currentAnswerState.userAnswer !== null}
                    >
                      <span>{option.text}</span>
                    </button>
                  ))}
                </div>
                {showRationale && (
                  <div className="mt-6 p-4 rounded-lg bg-gray-50 border-l-4 border-gray-300">
                    <h3 className="text-lg font-bold mb-2">Rationale</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{currentQuestion.rationale}</p>
                  </div>
                )}
              </div>
            </section>
          </main>

          <footer className="mt-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
            {/* Question navigation dropdown */}
            <div className="flex items-center space-x-2">
                <label htmlFor="question-select" className="text-sm text-gray-700 font-medium">Question</label>
                <select
                    id="question-select"
                    value={currentQuestionIndex}
                    onChange={handleDropdownChange}
                    className="p-2 rounded-lg border-2 border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {filteredQuestions.map((_, index) => (
                        <option key={index} value={index}>
                            {index + 1} of {filteredQuestions.length}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex space-x-4">
               <button
                onClick={handleBackToMenu}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-300"
              >
                Back to Menu
              </button>
              <button
                onClick={handleBack}
                disabled={currentQuestionIndex === 0}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {currentAnswerState.userAnswer === null ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={selectedOption === null}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLastQuestion ? 'Finish Test' : 'Next Question'}
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    );
  }
  
  // Render the Results UI
  if (appState === 'results') {
      return (
          <div className="flex flex-col justify-center items-center h-screen bg-gray-100 p-4">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Test Finished!</h2>
              <p className="text-lg text-gray-600 mb-8">You have completed all the questions in your selected topics.</p>
              <button
                  onClick={handleBackToMenu}
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors duration-200"
              >
                  Return to Main Menu
              </button>
          </div>
      );
  }

  // Fallback for cases where filteredQuestions is empty after loading
  if (appState === 'test' && filteredQuestions.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 p-4">
        <div className="text-xl text-gray-700">No questions found for the selected topics.</div>
      </div>
    );
  }

  return null; // Don't render anything else if state is not recognized
}

export default App;
