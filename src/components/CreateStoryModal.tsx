import React, { useState, useRef, useEffect } from 'react';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import StoryEditor from '@/components/story/StoryEditor';
import { useFileManager } from '@/components/CustomFilePicker';
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

  // Hidden file input ref — used to bypass the modal and go straight to file selection
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track whether we already triggered the file picker for this open cycle
  const didTriggerRef = useRef(false);

  // When isOpen transitions to true, immediately trigger the native file picker
  useEffect(() => {
    if (isOpen && !showEditor && !isUploading && storyManager.files.length === 0) {
      if (!didTriggerRef.current) {
        didTriggerRef.current = true;
        // Small delay to ensure DOM is ready
        requestAnimationFrame(() => {
          fileInputRef.current?.click();
        });
      }
    }
    if (!isOpen) {
      didTriggerRef.current = false;
    }
  }, [isOpen, showEditor, isUploading, storyManager.files.length]);

  // When a file is selected via the input, add it to the manager
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User cancelled the file picker
      onClose();
      return;
    }

    const kind = file.type.startsWith('video/') ? 'video' as const : 'image' as const;
    storyManager.addFiles([{
      id: Math.random().toString(36).slice(2, 9),
      file,
      url: URL.createObjectURL(file),
      kind,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      status: 'idle',
    }]);

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  // When the file picker is cancelled (no file selected), close the modal
  // The 'cancel' event fires when the user dismisses the file dialog
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const handleCancel = () => {
      // Only close if we don't already have files or editor open
      if (!showEditor && storyManager.files.length === 0) {
        onClose();
      }
    };

    input.addEventListener('cancel', handleCancel);
    return () => input.removeEventListener('cancel', handleCancel);
  }, [onClose, showEditor, storyManager.files.length]);

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

  return (
    <>
      {/* Hidden file input — triggers immediately when modal opens */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

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
