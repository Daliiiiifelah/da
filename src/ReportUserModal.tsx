import React, { useState, FormEvent } from 'react';
    import { useMutation } from 'convex/react';
    import { api } from '../convex/_generated/api';
    import { Id } from '../convex/_generated/dataModel';
    import { toast } from 'sonner';
    import { reportCategories } from '../convex/reports'; // Assuming reportCategories is exported from reports.ts

    // --- Reusable Components (subset from UserProfileModal for this specific modal) ---
    const Button = ({ onClick, children, className = "", disabled = false, variant = "primary", type, size }: { onClick?: () => void; children: React.ReactNode; className?: string; disabled?: boolean; variant?: "primary" | "secondary" | "danger" | "ghost" | "accent"; type?: "button" | "submit" | "reset", size?: "sm" | "md" }) => {
      const baseStyle = "px-4 py-2 rounded font-semibold shadow-sm hover:shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";
      const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2" };
      const variants = {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost: "bg-transparent text-primary hover:bg-primary/10",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
      };
      return <button type={type} onClick={onClick} className={`${baseStyle} ${sizes[size ?? 'md']} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
    };

    const Modal = ({ isOpen, onClose, title, children, size = "md" }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) => {
      if (!isOpen) return null;
      const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" };
      return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4"> {/* Higher z-index */}
          <div className={`bg-card p-6 rounded-lg shadow-xl w-full ${sizeClasses[size]}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-primary">{title}</h3>
              <Button onClick={onClose} variant="ghost" className="text-muted-foreground hover:text-card-foreground p-1 text-2xl">&times;</Button>
            </div>
            {children}
          </div>
        </div>
      );
    };
    
    const TextareaField = ({ label, value, onChange, placeholder, required = false, className = "", rows = 3 }: { label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; required?: boolean; className?: string; rows?: number; }) => (
      <div className={`mb-4 ${className}`}>
        {label && <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>}
        <textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={rows} className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground placeholder-muted-foreground" />
      </div>
    );
    
    const SelectField = ({ label, value, onChange, children, required = false, className = "" }: { label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; required?: boolean; className?: string; }) => (
        <div className={`mb-4 ${className}`}>
            {label && <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>}
            <select value={value} onChange={onChange} required={required} className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground placeholder-muted-foreground">
                {children}
            </select>
        </div>
    );
    // --- End Reusable Components ---

    function getErrorMessage(error: any): string {
      if (typeof error === 'string') return error;
      if (error?.data?.message) return error.data.message;
      if (error?.data?.details) return error.data.details;
      if (error?.message) return error.message;
      return "An unknown error occurred.";
    }

    // Define categories based on schema (ensure this matches convex/reports.ts if not imported directly)
    const CATEGORIES = ["violence", "bad_words", "match_absence", "spam", "other"] as const;
    type ReportCategory = typeof CATEGORIES[number];


    export function ReportUserModal({ isOpen, onClose, reportedUserId, reportedUserName, matchId }: { 
        isOpen: boolean; 
        onClose: () => void; 
        reportedUserId: Id<"users">; 
        reportedUserName: string;
        matchId?: Id<"matches">; // Optional match context
    }) {
      const [category, setCategory] = useState<ReportCategory>("other");
      const [description, setDescription] = useState("");
      const submitReportMutation = useMutation(api.reports.submitReport);
      const [isSubmitting, setIsSubmitting] = useState(false);

      const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!category) {
            toast.error("Please select a report category.");
            return;
        }
        setIsSubmitting(true);
        try {
          await submitReportMutation({
            reportedUserId,
            category,
            description: description.trim() === "" ? undefined : description.trim(),
            matchId,
          });
          toast.success(`Report against ${reportedUserName} submitted. Thank you.`);
          setDescription("");
          setCategory("other");
          onClose();
        } catch (error) {
          toast.error(`Failed to submit report: ${getErrorMessage(error)}`);
        } finally {
            setIsSubmitting(false);
        }
      };

      if (!isOpen) return null;

      return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Report ${reportedUserName}`} size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Help us keep The Tunisian Lock a fair and enjoyable community. Please provide details about the incident.</p>
            
            <SelectField
                label="Reason for Report"
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                required
            >
                <option value="" disabled>Select a category...</option>
                {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="text-card-foreground bg-input">
                        {cat.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())} 
                    </option>
                ))}
            </SelectField>

            <TextareaField
              label="Description (Optional but Recommended)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Provide more details about the incident involving ${reportedUserName}...`}
              rows={4}
            />
            {matchId && <p className="text-xs text-muted-foreground">This report will be associated with the current match context.</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" variant="danger" disabled={isSubmitting || !category}>
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </form>
        </Modal>
      );
    }
