import React, { useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo, 
  Link as LinkIcon,
  Code
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  isDark: boolean;
  className?: string;
}

const ToolbarButton = ({ 
  onClick, 
  isActive, 
  disabled, 
  children, 
  isDark,
  title
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  disabled?: boolean; 
  children: React.ReactNode; 
  isDark: boolean;
  title?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95",
      isActive 
        ? (isDark ? "bg-[#1DB954] text-black" : "bg-[#1DB954] text-white") 
        : (isDark ? "text-[#B3B3B3] hover:bg-[#282828] hover:text-white" : "text-[#5E5E5E] hover:bg-[#F0F0F0] hover:text-black"),
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    {children}
  </button>
);

const Toolbar = ({ editor, isDark }: { editor: Editor; isDark: boolean }) => {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-1 p-2 border-t mt-auto sticky bottom-0 z-20 backdrop-blur-md",
      isDark ? "bg-[#121212]/95 border-[#282828]" : "bg-white/95 border-[#E5E5E5]"
    )}>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        isDark={isDark}
        title="Bold"
      >
        <Bold size={18} strokeWidth={2.5} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        isDark={isDark}
        title="Italic"
      >
        <Italic size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        isDark={isDark}
        title="Underline"
      >
        <UnderlineIcon size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        isDark={isDark}
        title="Strikethrough"
      >
        <Strikethrough size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className={cn("w-[1px] h-6 mx-1", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        isDark={isDark}
        title="Bullet List"
      >
        <List size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        isDark={isDark}
        title="Ordered List"
      >
        <ListOrdered size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className={cn("w-[1px] h-6 mx-1", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />

      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive('link')}
        isDark={isDark}
        title="Link"
      >
        <LinkIcon size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        isDark={isDark}
        title="Quote"
      >
        <Quote size={18} strokeWidth={2.5} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        isDark={isDark}
        title="Code"
      >
        <Code size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <div className={cn("w-[1px] h-6 mx-1", isDark ? "bg-[#282828]" : "bg-[#E5E5E5]")} />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        isDark={isDark}
        title="Undo"
      >
        <Undo size={18} strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        isDark={isDark}
        title="Redo"
      >
        <Redo size={18} strokeWidth={2.5} />
      </ToolbarButton>
    </div>
  );
};

export const RichTextEditor = ({ value, onChange, placeholder, isDark, className }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#1DB954] underline cursor-pointer hover:text-[#1ED760]',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'prose focus:outline-none min-h-[200px] max-w-none px-8 py-6',
          isDark ? 'text-[#EAEAEA]' : 'text-[#121212]',
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update content if value changes externally (and isn't the same as current content to avoid cursor jumps)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Only update if the content is truly different to avoid cursor reset issues
      // A more robust check might be needed for real-time collaboration, but for local state this is usually okay
      // if we are careful. However, for a controlled input, it's tricky with Tiptap.
      // Usually better to let Tiptap manage state and only update on initial load or reset.
      // But for a simple compose window, we might just want to set content on mount.
      
      // If we are typing, onUpdate fires, updating parent state. Parent passes back new value.
      // If we setContent here, it resets cursor.
      // So we should only set content if the editor is empty and value is not (initial load)
      // OR check if content is significantly different.
      
      // For this use case (compose), 'value' is likely just initial state or draft.
      // Let's assume we only set it if editor is empty to be safe, or just rely on initial content.
      
      if (editor.isEmpty && value) {
         editor.commands.setContent(value);
      }
    }
  }, [value, editor]);

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <EditorContent editor={editor} />
      </div>
      {editor && <Toolbar editor={editor} isDark={isDark} />}
    </div>
  );
};
