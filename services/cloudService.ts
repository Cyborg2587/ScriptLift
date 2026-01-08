import { supabase } from './supabaseClient';
import { Project, ProjectStatus } from '../types';

// Upload file to Supabase Storage
export const uploadFileToCloud = async (file: File, userId: string): Promise<string> => {
  // Create a folder structure: userId/timestamp_filename
  const filePath = `${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  
  const { error } = await supabase.storage
    .from('files')
    .upload(filePath, file);

  if (error) throw error;
  return filePath;
};

// Create Project Record in Database
export const createCloudProject = async (project: Project, userId: string) => {
  const { error } = await supabase.from('projects').insert({
    id: project.id,
    user_id: userId,
    file_name: project.fileName,
    file_type: project.fileType,
    storage_path: project.storagePath,
    status: project.status,
    created_at: new Date(project.createdAt).toISOString(),
    expires_at: new Date(project.expiresAt).toISOString(),
    speaker_map: project.speakerMap,
    transcription: project.transcription
  });

  if (error) throw error;
};

// Get All Projects for User
export const getCloudProjects = async (userId: string): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((row: any) => ({
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    storagePath: row.storage_path,
    status: row.status as ProjectStatus,
    transcription: row.transcription,
    speakerMap: row.speaker_map || {},
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : 0,
  }));
};

// Update Project (e.g., status, transcription, speaker names)
export const updateCloudProject = async (project: Project) => {
  const { error } = await supabase
    .from('projects')
    .update({
      status: project.status,
      transcription: project.transcription,
      speaker_map: project.speakerMap
    })
    .eq('id', project.id);

  if (error) throw error;
};

// Delete Project
export const deleteCloudProject = async (project: Project) => {
  // 1. Delete from DB
  const { error: dbError } = await supabase
    .from('projects')
    .delete()
    .eq('id', project.id);

  if (dbError) throw dbError;

  // 2. Delete from Storage (if path exists)
  if (project.storagePath) {
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([project.storagePath]);
      
    if (storageError) console.error("Failed to delete file from storage", storageError);
  }
};

// Get a temporary signed URL to play the file
export const getCloudFileUrl = async (path: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('files')
    .createSignedUrl(path, 3600); // Valid for 1 hour

  if (error) {
    console.error("Error getting signed URL", error);
    return null;
  }
  return data.signedUrl;
};

// Download the actual file blob (needed for processing)
export const downloadCloudFile = async (path: string): Promise<Blob | null> => {
  const { data, error } = await supabase.storage
    .from('files')
    .download(path);

  if (error) {
    console.error("Error downloading file", error);
    return null;
  }
  return data;
};