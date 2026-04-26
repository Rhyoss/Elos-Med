'use client';

import * as React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, List, ListOrdered, Underline as UnderlineIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SoapEditorProps {
  value:       string;
  onChange:    (value: string) => void;
  label:       string;
  placeholder?: string;
  disabled?:   boolean;
  minHeight?:  string;
  id?:         string;
  ariaDescribedby?: string;
}

/**
 * Editor Tiptap mínimo para campos SOAP. Emite HTML em onChange.
 * Desativa recursos que não fazem sentido num prontuário (imagens, links, etc.).
 */
export function SoapEditor({
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  minHeight = '6rem',
  id,
  ariaDescribedby,
}: SoapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? 'Comece a digitar…' }),
    ],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'role':             'textbox',
        'aria-multiline':   'true',
        'aria-label':       label,
        'aria-describedby': ariaDescribedby ?? '',
        'id':               id ?? '',
        'class': cn(
          'prose prose-sm max-w-none focus:outline-none',
          'px-3 py-2 text-sm text-foreground',
          'min-h-[var(--soap-min-h)]',
        ),
        'style': `--soap-min-h: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Atualiza quando o valor externo muda (ex.: aceitar sugestão de IA ou carregar do servidor)
  React.useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || '', false);
  }, [editor, value]);

  // Sincroniza estado editable
  React.useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== !disabled) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div
        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground"
        style={{ minHeight }}
        aria-label={label}
      >
        Carregando editor…
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
        disabled && 'opacity-70 pointer-events-none',
      )}
    >
      <div
        role="toolbar"
        aria-label={`Formatação — ${label}`}
        className="flex items-center gap-0.5 border-b border-border px-1 py-1"
      >
        <ToolbarButton
          label="Negrito"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Itálico"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Sublinhado"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
        >
          <UnderlineIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <ToolbarButton
          label="Lista com marcadores"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label:    string;
  onClick:  () => void;
  active?:  boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground',
        'hover:bg-hover hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-primary-100 text-primary-700',
      )}
    >
      {children}
    </button>
  );
}
