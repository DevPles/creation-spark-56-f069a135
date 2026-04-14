import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `px-2 py-1 text-xs rounded transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
        B
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
        I
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}>
        T
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
        Lista
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
        1. Lista
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>
        Citação
      </button>
      <div className="border-l border-border mx-1" />
      <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn(false)}>
        Desfazer
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn(false)}>
        Refazer
      </button>
    </div>
  );
};

const RichTextEditor = ({ content, onChange, placeholder = "Digite aqui...", editable = true }: Props) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content]);

  return (
    <div className="border border-input rounded-lg overflow-hidden bg-background">
      {editable && <MenuBar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 min-h-[160px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
};

export default RichTextEditor;
