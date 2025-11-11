
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { generateForTeacher, generateForStudent, analyzeStudentWork } from './services/geminiService';
import type { TeacherContent, StudentContent, Task, StudentAnalysis, Resource, Role, AnyUser, Teacher, Student, Parent, StudentProgress } from './types';

// --- HELPER FUNCTIONS ---
const generateId = () => Math.random().toString(36).substring(2, 10);
const generateClassCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// --- UI COMPONENTS ---
const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const getResourceIcon = (type: Resource['type']) => {
  switch (type) {
    case 'video': return '▶️';
    case 'ebook': return '📖';
    case 'website': return '🌐';
    case 'interactive': return '🎮';
    default: return '🔗';
  }
};

const Resources: React.FC<{ resources: Resource[] }> = ({ resources }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">{t('externalResources')}</h2>
      <ul className="space-y-3">
        {resources.map((res, index) => (
          <li key={index} className="flex items-start">
            <span className="mr-3 text-lg">{getResourceIcon(res.type)}</span>
            <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800 transition-colors">
              {res.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AnalysisView: React.FC<{ analysis: StudentAnalysis }> = ({ analysis }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-3 mb-4">{t('analysis')}</h2>
            <div className="space-y-6">
            {analysis.feedback.map((fb, index) => (
               <div key={index} className="border-t border-gray-200 pt-4 first:border-t-0 first:pt-0">
                  <p className="font-semibold text-gray-800">{fb.question}</p>
                  <p className="text-sm text-gray-600 my-2 italic">"{fb.studentAnswer}"</p>
                  {fb.isCorrect ? (
                     <div className="flex items-center text-green-600 font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        {t('correct')}
                    </div>
                  ) : (
                    <>
                    <div className="flex items-center text-red-600 font-bold">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      {t('incorrect')}
                    </div>
                    <div className="mt-2 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg">
                        <p><strong>{t('explanation')}:</strong> {fb.explanation}</p>
                    </div>
                    </>
                  )}
               </div>
            ))}
            </div>
        </div>
    );
};

// --- AUTHENTICATION PAGE ---
const AuthPage: React.FC<{
    users: AnyUser[];
    setUsers: React.Dispatch<React.SetStateAction<AnyUser[]>>;
    setCurrentUser: React.Dispatch<React.SetStateAction<AnyUser | null>>;
}> = ({ users, setUsers, setCurrentUser }) => {
    const { t, i18n } = useTranslation();
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>('student');
    const [teacherCode, setTeacherCode] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [error, setError] = useState('');
    const [language, setLanguage] = useState(i18n.language.split('-')[0] || 'en');

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const lang = e.target.value;
        setLanguage(lang);
        i18n.changeLanguage(lang);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isLogin) {
            const user = users.find(u => u.email === email && u.password === password);
            if (user) {
                setCurrentUser(user);
            } else {
                setError(t('authError'));
            }
        } else { // Register
            if (users.some(u => u.email === email)) {
                setError(t('emailExistsError'));
                return;
            }
            const teacher = users.find(u => u.role === 'teacher' && (u as Teacher).classCode === teacherCode) as Teacher | undefined;
            const parent = users.find(u => u.role === 'parent' && u.email === parentEmail) as Parent | undefined;

            let newUser: AnyUser;
            const common = { id: generateId(), name, email, password };

            if (role === 'teacher') {
                newUser = { ...common, role: 'teacher', classCode: generateClassCode() };
            } else if (role === 'parent') {
                newUser = { ...common, role: 'parent' };
            } else { // Student
                newUser = { ...common, role: 'student', teacherId: teacher?.id, parentId: parent?.id };
            }
            const updatedUsers = [...users, newUser];
            setUsers(updatedUsers);
            setCurrentUser(newUser);
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 relative">
                <div className="absolute top-4 right-4">
                    <select value={language} onChange={handleLanguageChange} className="bg-blue-600 text-white border-blue-700 text-sm rounded-lg block p-2.5 focus:ring-blue-500 focus:border-blue-500">
                        <option value="en">English</option>
                        <option value="ru">Русский</option>
                        <option value="kz">Қазақша</option>
                    </select>
                </div>
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">{t('title')}</h1>
                <h2 className="text-xl font-bold text-center text-gray-800 mb-6">{isLogin ? t('login') : t('register')}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
                    {!isLogin && (
                        <>
                            <input type="text" placeholder={t('name')} value={name} onChange={e => setName(e.target.value)} required className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"/>
                            <div className="flex justify-center rounded-lg p-1 bg-gray-200">
                                {(['teacher', 'student', 'parent'] as Role[]).map(r => (
                                    <button type="button" key={r} onClick={() => setRole(r)} className={`w-1/3 py-2 text-sm font-medium rounded-md transition-colors ${role === r ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:bg-gray-300'}`}>{t(r)}</button>
                                ))}
                            </div>
                        </>
                    )}
                    <input type="email" placeholder={t('email')} value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"/>
                    <input type="password" placeholder={t('password')} value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"/>
                    {!isLogin && role === 'student' && (
                        <>
                            <input type="text" placeholder={t('classCodePlaceholder')} value={teacherCode} onChange={e => setTeacherCode(e.target.value)} className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"/>
                            <input type="email" placeholder={t('parentEmailPlaceholder')} value={parentEmail} onChange={e => setParentEmail(e.target.value)} className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"/>
                        </>
                    )}
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors">{isLogin ? t('login') : t('register')}</button>
                </form>
                <p className="text-center mt-6 text-sm text-gray-600">
                    {isLogin ? t('noAccount') : t('hasAccount')}{' '}
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-medium text-blue-600 hover:underline">{isLogin ? t('registerHere') : t('loginHere')}</button>
                </p>
            </div>
        </div>
    );
};

// --- DASHBOARD COMPONENTS ---
const TeacherParentDashboard: React.FC<{
    currentUser: Teacher | Parent;
    users: AnyUser[];
    setUsers: React.Dispatch<React.SetStateAction<AnyUser[]>>;
    activities: StudentProgress[];
}> = ({ currentUser, users, setUsers, activities }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('generate');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedProgress, setSelectedProgress] = useState<StudentProgress | null>(null);
    const [childEmail, setChildEmail] = useState('');
    const [addMessage, setAddMessage] = useState({ type: '', text: '' });

    const myStudentsOrChildren = useMemo(() => {
        if (currentUser.role === 'teacher') {
            return users.filter(u => u.role === 'student' && u.teacherId === currentUser.id) as Student[];
        } else { // parent
            return users.filter(u => u.role === 'student' && u.parentId === currentUser.id) as Student[];
        }
    }, [users, currentUser]);

    const studentActivities = useMemo(() => {
        if (!selectedStudent) return [];
        return activities.filter(a => a.studentId === selectedStudent.id).sort((a, b) => b.timestamp - a.timestamp);
    }, [activities, selectedStudent]);

    const handleViewStudent = (student: Student) => {
        setSelectedStudent(student);
        setSelectedProgress(null);
    }
    
    const handleAddChild = (e: React.FormEvent) => {
        e.preventDefault();
        setAddMessage({ type: '', text: '' });

        const childToAdd = users.find(u => u.role === 'student' && u.email.toLowerCase() === childEmail.toLowerCase()) as Student | undefined;

        if (!childToAdd) {
            setAddMessage({ type: 'error', text: t('childNotFound') });
            return;
        }

        if (myStudentsOrChildren.some(s => s.id === childToAdd.id)) {
            setAddMessage({ type: 'error', text: t('childAlreadyLinked') });
            return;
        }

        const updatedUsers = users.map(user => 
            user.id === childToAdd.id 
            ? { ...user, parentId: currentUser.id } as Student
            : user
        );
        
        setUsers(updatedUsers);
        setAddMessage({ type: 'success', text: t('addChildSuccess') });
        setChildEmail('');
    };

    if (selectedStudent) {
         return (
            <div>
                <button onClick={() => setSelectedStudent(null)} className="mb-4 text-blue-600 hover:underline">&larr; {t('backToList')}</button>
                <h2 className="text-2xl font-bold mb-4">{t('progressFor')} {selectedStudent.name}</h2>
                {studentActivities.length === 0 ? <p>{t('noProgressYet')}</p> : (
                    <ul className="space-y-2">
                        {studentActivities.map(activity => (
                             <li key={activity.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{activity.topic}</p>
                                    <p className="text-sm text-gray-500">{new Date(activity.timestamp).toLocaleString()}</p>
                                </div>
                                <button onClick={() => setSelectedProgress(activity)} className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full hover:bg-blue-200">{t('viewDetails')}</button>
                            </li>
                        ))}
                    </ul>
                )}
                {selectedProgress && (
                    <div className="mt-8 border-t-2 border-blue-500 pt-6">
                         <h3 className="text-xl font-bold mb-4">{t('detailsFor')} "{selectedProgress.topic}"</h3>
                         <AnalysisView analysis={selectedProgress.analysis} />
                    </div>
                )}
            </div>
        );
    }

    if (currentUser.role === 'parent') {
        return (
            <div>
                 <h2 className="text-2xl font-bold mb-4">{t('myChildren')}</h2>
                 <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                     <h3 className="font-semibold mb-2">{t('addChild')}</h3>
                     <form onSubmit={handleAddChild} className="flex flex-col sm:flex-row gap-2">
                        <input type="email" value={childEmail} onChange={(e) => setChildEmail(e.target.value)} placeholder={t('childEmailPlaceholder')} required className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-black bg-white"/>
                        <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700">{t('addChild')}</button>
                     </form>
                     {addMessage.text && <p className={`mt-2 text-sm ${addMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{addMessage.text}</p>}
                 </div>
                 {myStudentsOrChildren.length === 0 ? (
                    <div className="text-center p-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">{t('noChildren')}</p>
                    </div>
                 ) : (
                    <ul className="space-y-3">
                        {myStudentsOrChildren.map(child => (
                            <li key={child.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                                <span className="font-semibold">{child.name}</span>
                                <button onClick={() => handleViewStudent(child)} className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full hover:bg-blue-200">{t('viewProgress')}</button>
                            </li>
                        ))}
                    </ul>
                 )}
            </div>
        );
    }
    
    // Teacher View
    return (
        <>
            <div className="flex justify-center mb-6 rounded-lg p-1 bg-gray-200 max-w-md mx-auto">
                <button onClick={() => setActiveTab('generate')} className={`w-1/2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'generate' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:bg-gray-300'}`}>{t('generateContent')}</button>
                <button onClick={() => setActiveTab('students')} className={`w-1/2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'students' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:bg-gray-300'}`}>{t('myStudents')}</button>
            </div>

            {activeTab === 'generate' ? <GeneratorView role="teacher" /> : (
                <div>
                     {myStudentsOrChildren.length === 0 ? (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-600">{t('noStudents')}</p>
                            <p className="mt-2 font-mono bg-blue-100 text-blue-800 p-2 rounded inline-block">{t('shareCode')} {currentUser.classCode}</p>
                        </div>
                     ) : (
                        <ul className="space-y-3">
                            {myStudentsOrChildren.map(student => (
                                <li key={student.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                                    <span className="font-semibold">{student.name}</span>
                                    <button onClick={() => handleViewStudent(student)} className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full hover:bg-blue-200">{t('viewProgress')}</button>
                                </li>
                            ))}
                        </ul>
                     )}
                </div>
            )}
        </>
    );
}

const StudentDashboard: React.FC<{
    currentUser: Student;
    activities: StudentProgress[];
    addActivity: (activity: StudentProgress) => void;
}> = ({ currentUser, activities, addActivity }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('learn');
    
    const myActivities = useMemo(() => {
        return activities.filter(a => a.studentId === currentUser.id).sort((a,b) => b.timestamp - a.timestamp);
    }, [activities, currentUser.id]);

    return (
        <>
            <div className="flex justify-center mb-6 rounded-lg p-1 bg-gray-200 max-w-md mx-auto">
                <button onClick={() => setActiveTab('learn')} className={`w-1/2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'learn' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:bg-gray-300'}`}>{t('learn')}</button>
                <button onClick={() => setActiveTab('progress')} className={`w-1/2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'progress' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:bg-gray-300'}`}>{t('myProgress')}</button>
            </div>
            
            {activeTab === 'learn' ? <GeneratorView role="student" onWorkSubmitted={addActivity} studentId={currentUser.id} /> : (
                 <div>
                    <h2 className="text-2xl font-bold mb-4">{t('completedTopics')}</h2>
                    {myActivities.length === 0 ? <p>{t('noProgressYet')}</p> : (
                        <div className="space-y-4">
                            {myActivities.map(activity => (
                                <details key={activity.id} className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                                    <summary className="font-semibold cursor-pointer">{activity.topic} <span className="text-sm text-gray-500 font-normal">- {new Date(activity.timestamp).toLocaleDateString()}</span></summary>
                                    <div className="mt-4 pt-4 border-t">
                                        <AnalysisView analysis={activity.analysis} />
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

// --- MAIN GENERATOR VIEW ---
const GeneratorView: React.FC<{
    role: 'teacher' | 'student';
    onWorkSubmitted?: (activity: StudentProgress) => void;
    studentId?: string;
}> = ({ role, onWorkSubmitted, studentId }) => {
    const { t, i18n } = useTranslation();
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [teacherContent, setTeacherContent] = useState<TeacherContent | null>(null);
    const [studentContent, setStudentContent] = useState<StudentContent | null>(null);
    const [studentAnswers, setStudentAnswers] = useState<string[]>([]);
    const [studentAnalysis, setStudentAnalysis] = useState<StudentAnalysis | null>(null);

    const language = i18n.language.split('-')[0] || 'en';

    const resetState = () => {
        setError(null);
        setTeacherContent(null);
        setStudentContent(null);
        setStudentAnalysis(null);
        setStudentAnswers([]);
    }

    const handleGenerate = async () => {
        if (!topic) return;
        setLoading(true);
        resetState();
        try {
            if (role === 'teacher') {
                const content = await generateForTeacher(topic, language);
                setTeacherContent(content);
            } else {
                const content = await generateForStudent(topic, language);
                setStudentContent(content);
                setStudentAnswers(new Array(content.tasks.length).fill(''));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('error'));
        } finally {
            setLoading(false);
        }
    };
  
    const handleAnswerChange = (index: number, value: string) => {
        const newAnswers = [...studentAnswers];
        newAnswers[index] = value;
        setStudentAnswers(newAnswers);
    };

    const handleAnalyze = async () => {
        if (!studentContent || !studentId || !onWorkSubmitted || studentAnswers.some(a => a === '')) return;
        setLoading(true);
        setError(null);
        setStudentAnalysis(null);
        try {
            const analysis = await analyzeStudentWork(topic, studentContent.tasks, studentAnswers, language);
            setStudentAnalysis(analysis);
            const newActivity: StudentProgress = {
                id: generateId(),
                studentId,
                topic,
                tasks: studentContent.tasks,
                answers: studentAnswers,
                analysis,
                timestamp: Date.now()
            };
            onWorkSubmitted(newActivity);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('topicPlaceholder')} className="flex-grow p-3 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"/>
                <button onClick={handleGenerate} disabled={loading || !topic} className="flex justify-center items-center bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                    {loading && <LoadingSpinner />} {loading ? t('loading') : t('generate')}
                </button>
            </div>
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert"><p>{error}</p></div>}
            
            <div className="bg-gray-50 -m-8 p-8 mt-0 rounded-b-xl">
                 {role === 'teacher' && teacherContent && (
                    <div>
                        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{t('lessonPlan')}</h2>
                            <div className="space-y-4">
                                <div><h3 className="font-semibold">{t('objectives')}</h3><ul className="list-disc list-inside mt-1">{teacherContent.lessonPlan.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></div>
                                <div><h3 className="font-semibold">{t('keyConcepts')}</h3><ul className="list-disc list-inside mt-1">{teacherContent.lessonPlan.keyConcepts.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                                <div><h3 className="font-semibold">{t('activity')}</h3><p className="mt-1">{teacherContent.lessonPlan.activity}</p></div>
                            </div>
                        </div>
                        <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm"><h2 className="text-xl font-semibold border-b pb-3 mb-4">{t('studentTasks')}</h2><div className="space-y-4">{teacherContent.tasks.map((task, i) => (<div key={i}><p><strong>{i + 1}. {task.question}</strong></p>{task.options && <ul className="list-alpha pl-6 mt-2">{task.options.map((o, oi) => <li key={oi}>{o}</li>)}</ul>}</div>))}</div></div>
                        <Resources resources={teacherContent.resources} />
                    </div>
                )}

                {role === 'student' && studentContent && (
                    <div>
                        <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm"><h2 className="text-xl font-semibold border-b pb-3 mb-4">{t('explanation')}</h2><p className="whitespace-pre-line">{studentContent.explanation}</p></div>
                        {!studentAnalysis ? (
                            <>
                                <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm"><h2 className="text-xl font-semibold border-b pb-3 mb-4">{t('practiceQuestions')}</h2><div className="space-y-6">{studentContent.tasks.map((task, i) => (<div key={i}><p className="font-medium mb-2">{i + 1}. {task.question}</p>{task.options ? (<div className="space-y-2">{task.options.map((o, oi) => (<label key={oi} className="flex items-center p-2 rounded-md hover:bg-gray-100"><input type="radio" name={`t-${i}`} value={o} checked={studentAnswers[i] === o} onChange={e => handleAnswerChange(i, e.target.value)} className="h-4 w-4 text-blue-600"/> <span className="ml-3">{o}</span></label>))}</div>) : (<textarea rows={4} className="w-full p-2 mt-2 border rounded-md text-black bg-white" value={studentAnswers[i]} onChange={e => handleAnswerChange(i, e.target.value)}/>)}</div>))}</div></div>
                                <div className="text-right"><button onClick={handleAnalyze} disabled={loading || studentAnswers.some(a => a === '')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">{loading ? t('loading') : t('submitAnswers')}</button></div>
                            </>
                        ) : <AnalysisView analysis={studentAnalysis} />}
                        <Resources resources={studentContent.resources} />
                    </div>
                )}
            </div>
        </>
    );
};

// --- APP ROOT ---
const App: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [users, setUsers] = useState<AnyUser[]>(() => JSON.parse(localStorage.getItem('smart-tutor-users') || '[]'));
    const [currentUser, setCurrentUser] = useState<AnyUser | null>(() => JSON.parse(localStorage.getItem('smart-tutor-user') || 'null'));
    const [activities, setActivities] = useState<StudentProgress[]>(() => JSON.parse(localStorage.getItem('smart-tutor-activities') || '[]'));
    const [language, setLanguage] = useState(i18n.language.split('-')[0] || 'en');
    
    useEffect(() => { localStorage.setItem('smart-tutor-users', JSON.stringify(users)); }, [users]);
    useEffect(() => { localStorage.setItem('smart-tutor-user', JSON.stringify(currentUser)); }, [currentUser]);
    useEffect(() => { localStorage.setItem('smart-tutor-activities', JSON.stringify(activities)); }, [activities]);

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const lang = e.target.value;
        setLanguage(lang);
        i18n.changeLanguage(lang);
    };

    const handleLogout = () => {
        setCurrentUser(null);
    };

    const addActivity = (activity: StudentProgress) => {
        setActivities(prev => [...prev, activity]);
    };

    if (!currentUser) {
        return <AuthPage users={users} setUsers={setUsers} setCurrentUser={setCurrentUser} />;
    }

    return (
        <div className="min-h-screen bg-gray-100 text-gray-800 font-sans p-4 sm:p-6 lg:p-8">
            <main className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
                <div className="p-6 sm:p-8">
                    <header className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 border-b border-gray-200 mb-6">
                        <div>
                             <h1 className="text-3xl font-bold text-gray-800">{t('title')}</h1>
                             <p className="text-gray-600">{t('welcome')}, {currentUser.name}!</p>
                        </div>
                        <div className="flex items-center gap-4 mt-4 sm:mt-0">
                            <select value={language} onChange={handleLanguageChange} className="bg-blue-600 text-white border-blue-700 text-sm rounded-lg block p-2.5 focus:ring-blue-500 focus:border-blue-500">
                                <option value="en">English</option>
                                <option value="ru">Русский</option>
                                <option value="kz">Қазақша</option>
                            </select>
                            <button onClick={handleLogout} className="text-sm font-medium text-blue-600 hover:underline">{t('logout')}</button>
                        </div>
                    </header>
                    {currentUser.role === 'student' ? (
                        <StudentDashboard currentUser={currentUser as Student} activities={activities} addActivity={addActivity} />
                    ) : (
                        <TeacherParentDashboard currentUser={currentUser as Teacher | Parent} users={users} setUsers={setUsers} activities={activities} />
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
