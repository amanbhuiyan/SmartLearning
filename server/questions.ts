import type { Question } from "@shared/schema";

// Function to generate math questions based on grade level
function generateMathQuestion(grade: number): Question {
  const operations = ['+', '-', '*'];
  let num1: number, num2: number, answer: string, operation: string;

  // Adjust difficulty based on grade
  switch(grade) {
    case 1:
      num1 = Math.floor(Math.random() * 10) + 1;
      num2 = Math.floor(Math.random() * 10) + 1;
      operation = operations[Math.floor(Math.random() * 2)]; // Only + and -
      break;
    case 2:
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      operation = operations[Math.floor(Math.random() * 2)];
      break;
    default:
      num1 = Math.floor(Math.random() * 50) + 1;
      num2 = Math.floor(Math.random() * 50) + 1;
      operation = operations[Math.floor(Math.random() * 3)];
  }

  let question: string, explanation: string;

  switch(operation) {
    case '+':
      answer = String(num1 + num2);
      question = `What is ${num1} + ${num2}?`;
      explanation = `To add ${num1} and ${num2}, we combine the quantities. ${num1} plus ${num2} equals ${answer}.`;
      break;
    case '-':
      // Ensure larger number comes first
      if (num2 > num1) [num1, num2] = [num2, num1];
      answer = String(num1 - num2);
      question = `What is ${num1} - ${num2}?`;
      explanation = `To subtract ${num2} from ${num1}, we take away ${num2} from ${num1}, leaving us with ${answer}.`;
      break;
    case '*':
      answer = String(num1 * num2);
      question = `What is ${num1} × ${num2}?`;
      explanation = `To multiply ${num1} by ${num2}, we add ${num1} to itself ${num2} times, giving us ${answer}.`;
      break;
    default:
      throw new Error('Invalid operation');
  }

  return {
    id: Math.floor(Math.random() * 1000000), // Random ID for now
    subject: "math",
    grade,
    question,
    answer,
    explanation
  };
}

// Function to generate English questions based on grade level
function generateEnglishQuestion(grade: number): Question {
  const questions = [
    {
      question: "Which word is a noun?",
      options: ["run", "happy", "book", "quickly"],
      answer: "book",
      explanation: "A noun is a person, place, thing, or idea. 'Book' is a thing, making it a noun."
    },
    {
      question: "Which word means the opposite of 'happy'?",
      options: ["sad", "glad", "mad", "bad"],
      answer: "sad",
      explanation: "The antonym (opposite) of 'happy' is 'sad'."
    },
    // Add more question templates as needed
  ];

  const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];

  return {
    id: Math.floor(Math.random() * 1000000),
    subject: "english",
    grade,
    question: selectedQuestion.question,
    answer: selectedQuestion.answer,
    explanation: selectedQuestion.explanation
  };
}

export function getDailyQuestions(subject: string, grade: number, count: number = 20): Question[] {
  const questions: Question[] = [];

  for (let i = 0; i < count; i++) {
    if (subject.toLowerCase() === "math") {
      questions.push(generateMathQuestion(grade));
    } else if (subject.toLowerCase() === "english") {
      questions.push(generateEnglishQuestion(grade));
    }
  }

  return questions;
}