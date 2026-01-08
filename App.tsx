import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from './components/Layout';
import Auth from './components/Auth';
import { User, TranscriptionResult, Project, ProjectStatus } from './types';
import { transcribeWithWhisper } from './services/whisperService';
import { identifySpeakers, detectSpeakersFromPauses } from './services/geminiService';
import { saveProject, getAllProjects, getProjectFile, updateProject, deleteProject, cleanupExpiredProjects, getStorageUsage } from './services/storageService';
import { uploadFileToCloud, createCloudProject, getCloudProjects, updateCloudProject, deleteCloudProject, getCloudFileUrl, downloadCloudFile } from './services/cloudService';
import { downloadPdf, downloadTxt, downloadDoc } from './services/exportService';
import { supabase } from './services/supabaseClient';
import { UploadCloud, Clock, FileText, File as FileIcon, FileVideo, Download, Loader2, Users, Mic, PlayCircle, ExternalLink, ArrowLeft, Lock, Trash2, CheckCircle, AlertCircle, HardDrive, Cloud } from 'lucide-react';

// Shared View Component (Unchanged)
const SharedTranscriptView: React.FC<{
  transcription: TranscriptionResult;
  mediaUrl: string | null;
  speakerMap: Record<string, string>;
  onBack: () => void;
}> = ({ transcription, mediaUrl, speakerMap, onBack }) => {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const jumpToTime = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      mediaRef.current.play();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-32">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-800">ScriptLift Shared View</span>
          </div>
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 py-8 flex-grow">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{transcription.fileName}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(transcription.date).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Private Link</span>
            </div>
          </div>
          <div className="p-6 space-y-4">
             {transcription.segments.map((segment, idx) => {
               const name = speakerMap[segment.speaker] || segment.speaker;
               const nextTimestamp = transcription.segments[idx + 1]?.timestamp || Infinity;
               const isActive = currentTime >= segment.timestamp && currentTime < nextTimestamp;
               return (
                 <div 
                   key={idx} 
                   onClick={() => jumpToTime(segment.timestamp)} 
                   className={`flex gap-4 p-3 rounded-lg cursor-pointer group transition-all duration-300
                     ${isActive ? 'bg-indigo-50 border-l-4 border-indigo-600 shadow-sm transform scale-[1.01]' : 'hover:bg-slate-50 border-l-4 border-transparent'}
                   `}
                 >
                   <div className="w-16 shrink-0 text-xs font-mono pt-1 text-slate-400">
                     {formatTime(segment.timestamp)}
                   </div>
                   <div>
                     <div className="text-xs font-bold mb-1 text-indigo-600">{name}</div>
                     <p className={`leading-relaxed ${isActive ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>
                       {segment.text}
                     </p>
                   </div>
                 </div>
               )
             })}
          </div>
        </div>
      </div>
      
      {mediaUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-[100]">
           <div className="bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] px-4 py-3">
              <div className="max-w-4xl mx-auto flex items-center gap-4">
                 <div className="w-full">
                   <video 
                      ref={mediaRef}
                      src={mediaUrl} 
                      controls 
                      className="w-full h-12 bg-transparent focus:outline-none"
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};


const App: React.FC = () => {
  // Constants
  const MAX_STORAGE_BYTES = 250 * 1024 * 1024; // 250 MB
  const USER_STORAGE_KEY = 'scriptlift_user';

  // --- User State ---
  const [user, setUser] = useState<User | null>(null);
  
  // --- Project State ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [storageUsage, setStorageUsage] = useState<number>(0);
  
  // --- Playback State for Selected Project ---
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // --- View Mode ---
  const [viewMode, setViewMode] = useState<'dashboard' | 'shared_preview'>('dashboard');

  // --- Display Options ---
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showSpeakers, setShowSpeakers] = useState(true);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLMediaElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  
  // Derived Data
  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
    [projects, selectedProjectId]
  );

  const uniqueSpeakers = useMemo(() => {
    if (!selectedProject?.transcription) return [];
    const speakers = new Set<string>();
    selectedProject.transcription.segments.forEach(seg => speakers.add(seg.speaker));
    return Array.from(speakers).sort(); 
  }, [selectedProject]);


  // --- Initialization ---
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    }
  }, []);

  // When user changes, load their projects from the cloud
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  // Queue Processing Loop
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingQueue) return;

      const nextProject = projects.find(p => p.status === ProjectStatus.QUEUED);
      if (!nextProject) return;

      setIsProcessingQueue(true);
      await processProject(nextProject);
      setIsProcessingQueue(false);
    };

    processQueue();
  }, [projects, isProcessingQueue]);

  // Load Media URL when selected project changes
  useEffect(() => {
    let activeUrl = true;
    
    const loadMedia = async () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl); // Revoke local URLs
      setMediaUrl(null);

      if (selectedProjectId && selectedProject) {
        if (selectedProject.storagePath) {
          // CLOUD MODE: Get signed URL
          const url = await getCloudFileUrl(selectedProject.storagePath);
          if (url && activeUrl) setMediaUrl(url);
        } else {
          // LOCAL MODE: Get blob from IndexedDB (Legacy or Offline)
          const blob = await getProjectFile(selectedProjectId);
          if (blob && activeUrl) {
            const url = URL.createObjectURL(blob);
            setMediaUrl(url);
          }
        }
      }
    };

    loadMedia();

    return () => {
      activeUrl = false;
    };
  }, [selectedProjectId, selectedProject]);

  
  // --- Logic ---

  const loadProjects = async () => {
    if (user) {
      // Load from Supabase
      try {
        const cloudProjects = await getCloudProjects(user.id);
        setProjects(cloudProjects);
      } catch (e) {
        console.error("Failed to load cloud projects", e);
      }
    } else {
      // Load from LocalDB
      const loaded = await getAllProjects();
      setProjects(loaded);
      updateStorageUsage();
    }
  };

  const updateStorageUsage = async () => {
    // Only strictly relevant for local storage mode
    const usage = await getStorageUsage();
    setStorageUsage(usage);
  };

  const handleLogin = async (userData: User) => {
    setUser(userData);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    // The useEffect will trigger loadProjects
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    setProjects([]);
    setSelectedProjectId(null);
    setMediaUrl(null);
    setViewMode('dashboard');
  };

  // Helper to process incoming files (from drop or select)
  const handleIncomingFiles = async (files: FileList | null) => {
    if (files && files.length > 0) {
      
      const newProjects: Project[] = [];
      const now = Date.now();
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) continue;

        const projectId = crypto.randomUUID();

        // Initial Project Object
        const newProject: Project = {
          id: projectId,
          fileName: file.name,
          fileType: file.type,
          createdAt: now,
          expiresAt: now + fourteenDays,
          status: ProjectStatus.QUEUED,
          transcription: null,
          speakerMap: {}
        };

        if (user) {
          // CLOUD MODE
          try {
            setProgressText(`Uploading ${file.name}...`);
            // 1. Upload File
            const storagePath = await uploadFileToCloud(file, user.id);
            newProject.storagePath = storagePath;
            
            // 2. Create DB Record
            await createCloudProject(newProject, user.id);
          } catch (e) {
            console.error("Upload failed", e);
            alert(`Failed to upload ${file.name}. Please try again.`);
            continue;
          }
        } else {
          // LOCAL MODE
          // Check storage limit
          if (storageUsage + file.size > MAX_STORAGE_BYTES) {
            alert("Storage Limit Exceeded (Local). Log in for cloud storage or delete files.");
            return;
          }
          await saveProject(newProject, file);
        }

        newProjects.push(newProject);
      }

      // Update State to trigger Queue
      setProjects(prev => [...newProjects, ...prev]);
      
      if (!user) updateStorageUsage();
      setProgressText("");

      // Auto-select the first uploaded file if nothing selected
      if (!selectedProjectId && newProjects.length > 0) {
        setSelectedProjectId(newProjects[0].id);
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleIncomingFiles(event.target.files);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await handleIncomingFiles(e.dataTransfer.files);
  };

  const processProject = async (project: Project) => {
    try {
      // Set status to Processing
      const processingProject = { ...project, status: ProjectStatus.PROCESSING };
      
      if (user) {
        await updateCloudProject(processingProject);
      } else {
        await updateProject(processingProject);
      }
      
      setProjects(prev => prev.map(p => p.id === project.id ? processingProject : p));
      
      // Get File Blob (From Cloud or Local)
      let file: File;
      
      if (user && project.storagePath) {
        setProgressText(`Downloading ${project.fileName} for processing...`);
        const blob = await downloadCloudFile(project.storagePath);
        if (!blob) throw new Error("Could not download file from cloud");
        file = new File([blob], project.fileName, { type: project.fileType });
      } else {
        // Local
        const blob = await getProjectFile(project.id);
        if (!blob) throw new Error("File not found in storage");
        file = new File([blob], project.fileName, { type: project.fileType });
      }

      // 1. Whisper (Running in Worker now)
      setProgressText(`Transcribing ${project.fileName} (Whisper)...`);
      const whisperSegments = await transcribeWithWhisper(file, (msg) => {
         // Simplify status for UI
         if (msg.includes('%')) setProgressText(`${project.fileName}: ${msg}`);
      });

      // 2. Gemini Diarization
      setProgressText(`Identifying speakers for ${project.fileName}...`);
      
      // Convert blob to base64 for Gemini
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
           const result = reader.result as string;
           resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      let finalSegments = whisperSegments;

      try {
        const diarizedSegments = await identifySpeakers(base64String, project.fileType, whisperSegments);
        const uniqueSpeakers = new Set(diarizedSegments.map(s => s.speaker));
        
        finalSegments = diarizedSegments;

        // Fallback logic
        if (uniqueSpeakers.size === 1 && whisperSegments.length > 10) {
           const pauseBased = detectSpeakersFromPauses(whisperSegments);
           if (new Set(pauseBased.map(s => s.speaker)).size > 1) {
             finalSegments = pauseBased;
           }
        }
      } catch (e) {
        console.warn("Diarization failed, using fallback");
        finalSegments = detectSpeakersFromPauses(whisperSegments);
      }

      // 3. Complete
      const result: TranscriptionResult = {
        id: project.id,
        fileName: project.fileName,
        segments: finalSegments,
        rawText: finalSegments.map(s => s.text).join(' '),
        date: new Date().toISOString()
      };

      const completedProject: Project = { 
        ...processingProject, 
        status: ProjectStatus.COMPLETED,
        transcription: result
      };

      if (user) {
        await updateCloudProject(completedProject);
      } else {
        await updateProject(completedProject);
      }
      
      setProjects(prev => prev.map(p => p.id === project.id ? completedProject : p));

    } catch (error) {
      console.error(`Error processing ${project.fileName}`, error);
      const errorProject = { ...project, status: ProjectStatus.ERROR };
      
      if (user) await updateCloudProject(errorProject);
      else await updateProject(errorProject);

      setProjects(prev => prev.map(p => p.id === project.id ? errorProject : p));
    } finally {
      setProgressText('');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project?")) {
      const projectToDelete = projects.find(p => p.id === id);
      if (projectToDelete) {
        if (user) {
          await deleteCloudProject(projectToDelete);
        } else {
          await deleteProject(id);
          updateStorageUsage();
        }
      }
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const handleExport = (type: 'pdf' | 'txt' | 'doc') => {
    if (!selectedProject?.transcription) return;
    if (type === 'pdf') {
      downloadPdf(selectedProject.transcription, showTimestamps, showSpeakers, selectedProject.speakerMap);
    } else if (type === 'doc') {
      downloadDoc(selectedProject.transcription, showTimestamps, showSpeakers, selectedProject.speakerMap);
    } else {
      downloadTxt(selectedProject.transcription, showTimestamps, showSpeakers, selectedProject.speakerMap);
    }
  };

  const updateSpeakerName = (originalId: string, newName: string) => {
    if (!selectedProject) return;
    
    const updatedMap = { ...selectedProject.speakerMap, [originalId]: newName };
    const updatedProject = { ...selectedProject, speakerMap: updatedMap };
    
    // Optimistic UI update
    setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
    
    // Persist
    if (user) updateCloudProject(updatedProject);
    else updateProject(updatedProject);
  };

  const jumpToTime = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      mediaRef.current.play();
    }
  };
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // --- Render ---

  if (viewMode === 'shared_preview' && selectedProject?.transcription) {
    return (
      <SharedTranscriptView 
        transcription={selectedProject.transcription} 
        mediaUrl={mediaUrl} 
        speakerMap={selectedProject.speakerMap}
        onBack={() => setViewMode('dashboard')} 
      />
    );
  }

  if (!user) {
    return (
      <Layout user={null} onLogout={() => {}} currentView='dashboard' onChangeView={() => {}}>
        <Auth onLogin={() => {
           // We pass a dummy user here because Auth handles the actual login via Supabase
           // and calls onLogin when done. But Auth component needs refactoring if we want to pass the user object back.
           // However, for now Auth just calls onLogin(). We can reload the user from local storage or fetch.
           // Wait, Auth logic in Auth.tsx doesn't pass user back. Let's rely on listener or just simple reload.
           // Actually, the best way in this architecture is to have Auth fetch the user and pass it.
           // But since Auth uses supabase.auth, we can get the user immediately.
           supabase.auth.getUser().then(({ data }) => {
              if (data.user) {
                 const userData: User = { 
                   id: data.user.id, 
                   email: data.user.email!, 
                   name: data.user.user_metadata.name || 'User' 
                 };
                 handleLogin(userData);
              }
           });
        }} />
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} currentView={viewMode as any} onChangeView={setViewMode}>
      
      {/* DASHBOARD VIEW */}
      {viewMode === 'dashboard' && (
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-grow flex flex-col pb-32">
        
        {/* Top Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500">
              {user 
                ? "Your files are securely stored in the cloud." 
                : "Files are stored locally for 14 days."}
            </p>
          </div>
          
          {selectedProject?.status === ProjectStatus.COMPLETED && (
             <div className="flex gap-2 flex-wrap items-center">
               <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden mr-2">
                 <button onClick={() => setViewMode('shared_preview')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-600 text-sm font-medium"><ExternalLink className="w-4 h-4" /> View</button>
               </div>
               <div className="h-6 w-px bg-slate-200 mx-2 hidden lg:block"></div>
               <button onClick={() => handleExport('txt')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium"><FileText className="w-4 h-4" /> TXT</button>
               <button onClick={() => handleExport('doc')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-blue-700 rounded-lg text-sm font-medium"><FileText className="w-4 h-4" /> Word</button>
               <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm"><Download className="w-4 h-4" /> PDF</button>
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow h-full min-h-[500px]">
          
          {/* LEFT COLUMN: Upload & Project List */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Upload Zone */}
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all bg-white
                ${isProcessingQueue ? 'border-amber-300' : 'hover:border-indigo-500 hover:bg-indigo-50/50 border-slate-300'}
              `}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="audio/*,video/*" 
                className="hidden" 
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className={`p-3 rounded-full ${isProcessingQueue ? 'bg-amber-100' : 'bg-indigo-50'}`}>
                  {isProcessingQueue ? <Loader2 className="w-6 h-6 text-amber-600 animate-spin" /> : <UploadCloud className="w-6 h-6 text-indigo-600" />}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Upload Files</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {isProcessingQueue ? progressText : 'Drag & Drop files here or click to upload'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Project List (The "History") */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col max-h-[600px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <span className="font-semibold text-sm text-slate-700 uppercase tracking-wider">Your Projects</span>
                <span className="text-xs text-slate-400">{projects.length} Files</span>
              </div>
              
              <div className="overflow-y-auto flex-grow">
                {projects.length === 0 ? (
                   <div className="p-8 text-center text-slate-400 text-sm">No projects yet. Upload a file to get started.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {projects.map((p) => (
                      <div 
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between group
                          ${selectedProjectId === p.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}
                        `}
                      >
                        <div className="min-w-0 flex-grow pr-4">
                          <h4 className={`text-sm font-medium truncate ${selectedProjectId === p.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                            {p.fileName}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            {p.storagePath && <Cloud className="w-3 h-3 text-indigo-400" />}
                            {p.status === ProjectStatus.QUEUED && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> Queued</span>}
                            {p.status === ProjectStatus.PROCESSING && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Processing</span>}
                            {p.status === ProjectStatus.COMPLETED && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Ready</span>}
                            {p.status === ProjectStatus.ERROR && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Failed</span>}
                            
                            <span className="text-[10px] text-slate-400">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteProject(e, p.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                 
                 {/* Storage Bar (Local Only) */}
                 {!user ? (
                   <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 text-center mb-3">Projects automatically deleted after 14 days.</p>
                      <div className="flex justify-between items-center text-[10px] font-medium text-slate-600">
                          <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
                          <span>{formatBytes(storageUsage)} / 250 MB</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${storageUsage / MAX_STORAGE_BYTES > 0.9 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                            style={{ width: `${Math.min((storageUsage / MAX_STORAGE_BYTES) * 100, 100)}%` }}
                          ></div>
                      </div>
                      {storageUsage / MAX_STORAGE_BYTES > 0.9 && (
                         <p className="text-[10px] text-red-500 text-center mt-1">Storage nearly full.</p>
                      )}
                   </div>
                 ) : (
                    <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                       <Cloud className="w-4 h-4 text-indigo-500" />
                       Files synced to cloud
                    </div>
                 )}
              </div>
            </div>

            {/* 3. Settings (Conditional) */}
            {selectedProject?.transcription && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Display Options</h3>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /><span className="text-sm text-slate-700">Show Timestamps</span></div>
                      <div className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={showTimestamps} onChange={() => setShowTimestamps(!showTimestamps)} /><div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 transition-all"></div></div>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" /><span className="text-sm text-slate-700">Show Speakers</span></div>
                      <div className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={showSpeakers} onChange={() => setShowSpeakers(!showSpeakers)} /><div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 transition-all"></div></div>
                    </label>
                  </div>
                  <div className="border-t border-slate-100 pt-4"></div>
                  <div className="space-y-3">
                    <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Identify Speakers</h3>
                    <div className="space-y-3">
                      {uniqueSpeakers.map((speakerId) => (
                        <div key={speakerId} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><Mic className="w-4 h-4 text-slate-500" /></div>
                          <div className="flex-grow">
                              <label className="text-[10px] text-slate-400 font-medium block mb-0.5 ml-1">{speakerId}</label>
                              <input 
                                type="text" 
                                className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" 
                                placeholder="Enter Name..." 
                                value={selectedProject.speakerMap[speakerId] || ""} 
                                onChange={(e) => updateSpeakerName(speakerId, e.target.value)} 
                              />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Transcript Viewer */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[600px] lg:h-auto">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="font-semibold text-slate-700">
                {selectedProject ? `Transcription: ${selectedProject.fileName}` : 'Transcription Output'}
              </span>
              {selectedProject?.transcription && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">{selectedProject.transcription.segments.length} segments</span>}
            </div>
            
            <div className="flex-grow overflow-y-auto p-6 space-y-4" ref={transcriptContainerRef}>
              
              {!selectedProject && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p>Select a project from the left to view the transcript.</p>
                </div>
              )}

              {selectedProject && selectedProject.status === ProjectStatus.QUEUED && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Clock className="w-12 h-12 mb-4 text-indigo-300" />
                  <p className="font-medium text-slate-600">File Queued</p>
                  <p className="text-sm">Waiting for processor...</p>
                </div>
              )}

              {selectedProject && selectedProject.status === ProjectStatus.PROCESSING && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-12 h-12 mb-4 text-amber-500 animate-spin" />
                  <p className="font-medium text-slate-600">Processing File</p>
                  <p className="text-sm">{progressText || "This may take a moment..."}</p>
                </div>
              )}

               {selectedProject && selectedProject.status === ProjectStatus.ERROR && (
                <div className="h-full flex flex-col items-center justify-center text-red-400">
                  <AlertCircle className="w-12 h-12 mb-4" />
                  <p className="font-medium text-red-600">Processing Failed</p>
                  <p className="text-sm">Please try uploading again.</p>
                </div>
              )}

              {selectedProject?.transcription && selectedProject.transcription.segments.map((segment, index) => {
                const displayName = selectedProject.speakerMap[segment.speaker] || segment.speaker;
                
                const effectiveStart = segment.timestamp;
                const nextSeg = selectedProject.transcription!.segments[index + 1];
                const effectiveEnd = nextSeg ? nextSeg.timestamp : effectiveStart + 5; 

                const isActive = currentTime >= effectiveStart && currentTime < effectiveEnd;
                
                return (
                  <div 
                    key={index} 
                    onClick={() => jumpToTime(segment.timestamp)}
                    className={`flex gap-3 group p-3 rounded-lg transition-all duration-300 cursor-pointer border-l-4
                      ${isActive 
                        ? 'bg-indigo-50 border-indigo-600 shadow-sm' 
                        : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}
                    `}
                  >
                    <div className="flex flex-col gap-1 items-start min-w-[80px] shrink-0 pt-1">
                      {showTimestamps && (
                        <div className={`flex items-center gap-1 group-hover:text-indigo-600 ${isActive ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                           {isActive && <PlayCircle className="w-3 h-3 animate-pulse" />}
                           <span className="text-xs font-mono font-medium select-none">
                             {formatTime(effectiveStart)}
                           </span>
                        </div>
                      )}
                      {showSpeakers && (
                         <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded select-none truncate max-w-[80px]" title={displayName}>
                           {displayName}
                         </span>
                      )}
                    </div>
                    <p className={`text-base leading-relaxed ${isActive ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>
                      {segment.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* FIXED BOTTOM PLAYER */}
      {viewMode === 'dashboard' && selectedProject && mediaUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-[100]">
           {/* If Video: Pop-up Player */}
           {selectedProject.fileType.startsWith('video/') && (
              <div className="absolute bottom-full right-4 sm:right-8 bg-black rounded-t-lg overflow-hidden shadow-2xl border-x border-t border-slate-800 w-80 sm:w-[480px] transition-all flex flex-col">
                  {/* Header/Close handle for video? standard controls have fullscreen. */}
                  <div className="bg-slate-900 px-3 py-1 flex justify-between items-center border-b border-slate-800">
                     <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Video Preview</span>
                     <button onClick={() => setSelectedProjectId(null)} className="text-slate-400 hover:text-white"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <video 
                    ref={mediaRef as React.RefObject<HTMLVideoElement>}
                    src={mediaUrl} 
                    controls 
                    className="w-full aspect-video bg-black"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  />
              </div>
           )}

           {/* The Bar - Background */}
           <div className="bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] px-4 py-3 relative z-10">
              <div className="max-w-6xl mx-auto flex items-center gap-4">
                 {/* File Info */}
                 <div className="flex items-center gap-3 w-64 shrink-0">
                   <div className="p-2 bg-indigo-50 rounded-lg">
                     {selectedProject.fileType.startsWith('video/') 
                       ? <FileVideo className="w-5 h-5 text-indigo-600" /> 
                       : <FileIcon className="w-5 h-5 text-indigo-600" />
                     }
                   </div>
                   <div className="min-w-0">
                     <p className="text-sm font-semibold text-slate-800 truncate">{selectedProject.fileName}</p>
                     <button onClick={() => setSelectedProjectId(null)} className="text-xs text-slate-500 hover:text-slate-700 font-medium hover:underline">
                        Close Player
                     </button>
                   </div>
                 </div>

                 {/* Audio Player Controls */}
                 <div className="flex-grow">
                    {/* If Audio, show full controls here. If Video, controls are popped up. */}
                    {!selectedProject.fileType.startsWith('video/') ? (
                       <audio 
                          ref={mediaRef as React.RefObject<HTMLAudioElement>}
                          src={mediaUrl} 
                          controls 
                          className="w-full h-10"
                          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        />
                    ) : (
                      <div className="flex items-center justify-between text-xs text-slate-400 italic bg-slate-50 p-2 rounded border border-slate-100">
                         <span>Video active in popup</span>
                         <span className="not-italic">⬆️</span>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;