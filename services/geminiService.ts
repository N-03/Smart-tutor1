import { GoogleGenAI, Type } from "@google/genai";
// FIX: Correct import path for types.
import type { TeacherContent, StudentContent, Task, StudentAnalysis } from './types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const model = 'gemini-2.5-flash';

const commonSystemInstruction = "You are an expert AI assistant for elementary schools in Kazakhstan. Your tone should be encouraging, clear, and simple. All content should be suitable for children aged 6-10.";

const languageMap: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  kz: 'Kazakh',
};

const resourceSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The title of the resource." },
    url: { type: Type.STRING, description: "The direct URL to the resource." },
    type: { type: Type.STRING, enum: ['video', 'ebook', 'website', 'interactive'], description: "The type of the resource." },
  },
  required: ["title", "url", "type"],
};


export const generateForTeacher = async (topic: string, language: string): Promise<TeacherContent> => {
  const response = await ai.models.generateContent({
    model,
    contents: `Generate a lesson plan, 5 student tasks, and 3-5 relevant external resources (videos, e-books, websites) for the topic: "${topic}". Ensure resource links are valid and child-friendly. Provide the response in ${languageMap[language]}.`,
    config: {
      systemInstruction: `${commonSystemInstruction} You are helping a teacher prepare.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          lessonPlan: {
            type: Type.OBJECT,
            properties: {
              objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
              activity: { type: Type.STRING },
            },
            required: ["objectives", "keyConcepts", "activity"],
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['multiple-choice', 'open-ended'] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["question", "type"],
            },
          },
          resources: {
            type: Type.ARRAY,
            items: resourceSchema,
          },
        },
        required: ["lessonPlan", "tasks", "resources"],
      },
    },
  });

  // FIX: Trim whitespace from the response text before parsing to prevent potential JSON errors.
  const parsed = JSON.parse(response.text.trim());
  return parsed as TeacherContent;
};

export const generateForStudent = async (topic: string, language: string): Promise<StudentContent> => {
  const response = await ai.models.generateContent({
    model,
    contents: `Explain the topic "${topic}", create 3 practice questions, and find 3 engaging external resources (like a fun video, a simple article, or an interactive game) for further learning. Ensure links are valid. Provide the response in ${languageMap[language]}.`,
    config: {
      systemInstruction: `${commonSystemInstruction} You are a friendly tutor explaining a topic to a student. Use simple language and analogies.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['multiple-choice', 'open-ended'] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["question", "type"],
            },
          },
          resources: {
            type: Type.ARRAY,
            items: resourceSchema,
          },
        },
        required: ["explanation", "tasks", "resources"],
      },
    },
  });
  
  // FIX: Trim whitespace from the response text before parsing to prevent potential JSON errors.
  const parsed = JSON.parse(response.text.trim());
  return parsed as StudentContent;
};

export const analyzeStudentWork = async (topic: string, tasks: Task[], answers: string[], language: string): Promise<StudentAnalysis> => {
  const tasksWithAnswers = tasks.map((task, index) => ({
    ...task,
    studentAnswer: answers[index],
  }));

  const response = await ai.models.generateContent({
    model,
    contents: `Analyze the student's answers for the topic "${topic}". For each incorrect answer, provide a gentle, clear explanation of the mistake and the correct concept. Provide the response in ${languageMap[language]}.
    
    Tasks and Answers:
    ${JSON.stringify(tasksWithAnswers)}`,
    config: {
      systemInstruction: `${commonSystemInstruction} You are an encouraging teaching assistant giving feedback. Be positive and focus on learning from mistakes.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          feedback: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                studentAnswer: { type: Type.STRING },
                isCorrect: { type: Type.BOOLEAN },
                explanation: { type: Type.STRING },
              },
              required: ["question", "studentAnswer", "isCorrect", "explanation"],
            },
          },
        },
        required: ["feedback"],
      },
    },
  });
  
  // FIX: Trim whitespace from the response text before parsing to prevent potential JSON errors.
  const parsed = JSON.parse(response.text.trim());
  return parsed as StudentAnalysis;
};
