import React, { useState, useEffect } from 'react';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import StoryEditor from '@/components/story/StoryEditor';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';
import { storyService } from '@/services/storyService';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateStory: (storyData: any) => void;
}

const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ isOpen, onClose, onCreateStory }) => {
  const { user } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const storyManager = useFileManager();

  // Editor state — supports both images and videos
  const [showEditor, setShowEditor] = useState(false);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string>('');
  const [editorMediaType, setEditorMediaType] = useState<'image' | 'video'>('image');

  // When file manager has a file, open the editor
  useEffect(() => {
    const activeFile = storyManager.files[0];
    if (activeFile && !showEditor) {
      setCroppedPreviewUrl(activeFile.url);
      setEditorMediaType(activeFile.kind === 'video' ? 'video' : 'image');
      setShowEditor(true);
    }
  }, [storyManager.files, showEditor]);

  if (!isOpen) return null;

  const handleEditorDone = async (editedBlob: Blob, mentionedUserIds?: string[], extraData?: any) => {
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in to create a story.", variant: "destructive" });
      return;
    }

    // Clear the active file immediately to prevent useEffect from re-opening the editor
    if (storyManager.files[0]) {
      storyManager.removeFile(storyManager.files[0].id);
    }

    setShowEditor(false);
    setIsUploading(true);

    try {
      const isVideo = extraData?.mediaType === 'video' && extraData?.originalVideoUrl;
      await storyService.createStory(user.id, editedBlob, isVideo, mentionedUserIds, extraData);

      onCreateStory(null);
      toast({ title: "Story created!", description: "Your story has been shared successfully." });
      onClose();
    } catch (error) {
      console.error('Story creation error:', error);
      toast({ title: "Upload failed", description: "Could not create your story. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditorCancel = () => {
    if (storyManager.files[0]) {
      storyManager.removeFile(storyManager.files[0].id);
    }
    setShowEditor(false);
    onClose();
  };

  // Called when the custom action sheet is dismissed without a file being selected
  const handleSheetDismiss = () => {
    if (!showEditor && storyManager.files.length === 0) {
      onClose();
    }
  };

  return (
    <>
      {/* 
        CustomFilePicker with autoOpen — immediately shows the "Choose Source" 
        action sheet (Camera / Photo Library / Video) when the story creation opens.
        No trigger button needed — the sheet opens on its own.
      */}
      {!showEditor && !isUploading && (
        <CustomFilePicker
          manager={storyManager}
          hideUploadButton
          hidePreviewList
          accept="image/*,video/*"
          autoOpen
          onSheetDismiss={handleSheetDismiss}
        />
      )}

      {/* Story Editor (fullscreen, above everything) */}
      {showEditor && croppedPreviewUrl && (
        <StoryEditor
          previewUrl={croppedPreviewUrl}
          mediaType={editorMediaType}
          onDone={handleEditorDone}
          onCancel={handleEditorCancel}
        />
      )}

      {/* Upload animation overlay — shown while story is being uploaded to Supabase */}
      {isUploading && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center">
          <VideoLoader size="lg" label="Uploading story..." sublabel="Please wait" />
        </div>
      )}
    </>
  );
};

export default CreateStoryModal;
