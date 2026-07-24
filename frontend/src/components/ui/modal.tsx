import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, AlertTriangle, Info } from 'lucide-react';
import { Button } from './button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideCloseButton?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className,
  hideCloseButton = false 
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      <div 
        className={cn(
          "relative w-full bg-white rounded-[12px] border border-slate-200 shadow-[0_8px_32px_rgba(15,23,42,0.15)] animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]",
          !className?.includes('max-w-') && "max-w-[95vw]",
          !className?.includes('w-') && "sm:w-[448px] sm:max-w-[448px]",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
            <h2 className="font-headline text-[20px] font-semibold text-[#0F172A] leading-[1.3] flex-1 pr-4">{title}</h2>
            {!hideCloseButton && (
              <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 h-8 w-8 p-0 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-[8px]">
                <X size={18} />
              </Button>
            )}
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}

export interface ConfirmModalProps extends ModalProps {
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isInfo?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  children, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  isDestructive = false,
  isInfo = false,
  className,
  hideCloseButton
}: ConfirmModalProps) {
  
  let TitleWithIcon = title;
  if (isDestructive && title) {
    TitleWithIcon = (
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0" />
        <span>{title}</span>
      </div>
    );
  } else if (isInfo && title) {
    TitleWithIcon = (
      <div className="flex items-center gap-2">
        <Info className="text-blue-500 w-5 h-5 flex-shrink-0" />
        <span>{title}</span>
      </div>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={TitleWithIcon} className={className} hideCloseButton={hideCloseButton}>
      <div className="font-body text-[16px] leading-[1.6] text-[#64748B] mb-8">
        {children}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {cancelText}
        </Button>
        <Button 
          variant={isDestructive ? 'destructive' : 'primary'} 
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
