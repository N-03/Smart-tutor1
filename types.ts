// FIX: Define data structures for type safety and to resolve module errors.
export interface Resource {
  title: string;
  url: string;
  type: 'video' | 'ebook' | 'website' | 'interactive';
}

export interface Task {
  question: string;
  type: 'multiple-choice' | 'open-ended';
  options?: string[];
}

export interface TeacherContent {
  lessonPlan: {
    objectives: string[];
    keyConcepts: string[];
    activity: string;
  };
  tasks: Task[];
  resources: Resource[];
}

export interface StudentContent {
  explanation: string;
  tasks: Task[];
  resources: Resource[];
}

export interface StudentAnalysis {
  feedback: {
    question: string;
    studentAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

// New types for user authentication and progress tracking
export type Role = 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface Teacher extends User {
  role: 'teacher';
  classCode: string;
}

export interface Student extends User {
  role: 'student';
  teacherId?: string;
  parentId?: string;
}

export interface Parent extends User {
  role: 'parent';
}

export type AnyUser = Teacher | Student | Parent;

export interface StudentProgress {
  id: string; // Unique ID for this progress entry
  studentId: string;
  topic: string;
  tasks: Task[];
  answers: string[];
  analysis: StudentAnalysis;
  timestamp: number;
}
