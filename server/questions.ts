import type { Question } from "@shared/schema";

const mockQuestions: Question[] = [
  {
    id: 1,
    subject: "math",
    gradeLevel: "year1",
    question: "What is 5 + 3?",
    answer: "8",
    explanation: "Adding 5 and 3 gives us 8"
  },
  {
    id: 2,
    subject: "math",
    gradeLevel: "year1",
    question: "What is 10 - 4?",
    answer: "6",
    explanation: "Subtracting 4 from 10 gives us 6"
  },
  // Add more mock questions here
];

export function getQuestions(subject: string, gradeLevel: string, count: number = 20): Question[] {
  return mockQuestions
    .filter(q => q.subject === subject && q.gradeLevel === gradeLevel)
    .slice(0, count);
}
