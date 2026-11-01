'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

interface ProcessingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  processingText?: ReactNode;
  isProcessing?: boolean;
}

export default function ProcessingButton({
  children,
  processingText = 'Processing…',
  isProcessing,
  disabled,
  type = 'button',
  className,
  ...props
}: ProcessingButtonProps) {
  const formStatus = useFormStatus();
  const pending = isProcessing ?? formStatus.pending;

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${className ?? ''} inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {pending ? processingText : children}
    </button>
  );
}
