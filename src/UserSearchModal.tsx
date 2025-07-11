import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { toast } from 'sonner';

// --- Reusable Components ---
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`bg-card p-6 rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-primary">{title}</h3>
          <Button onClick={onClose} variant="ghost" className="text-muted-foreground hover:text-card-foreground p-1 text-2xl">&times;</Button>
        </div>
        {children}
      </div>
    </div>
  );
};

const InputField = ({ label, type = "text", value, onChange, placeholder, required = false, className = "" }: { label?: string; type?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean; className?: string; }) => (
  <div className={`mb-4 ${className}`}>
    {label && <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground placeholder-muted-foreground" />
  </div>
);

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.data?.message) return error.data.message;
  if (error?.data?.details) return error.data.details;
  if (error?.message) return error.message;
  return "An unknown error occurred.";
}

export function UserSearchModal({ isOpen, onClose, onUserClick }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onUserClick: (userId: Id<"users">) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  const searchResults = useQuery(
    api.userProfiles.searchUsers, 
    debouncedSearchTerm.length >= 2 ? { searchTerm: debouncedSearchTerm } : "skip"
  );
  
  const sendFriendRequestMutation = useMutation(api.friends.sendFriendRequest);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSendFriendRequest = async (userId: Id<"users">, userName: string) => {
    try {
      await sendFriendRequestMutation({ requesteeId: userId });
      toast.success(`Friend request sent to ${userName}!`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUserProfileClick = (userId: Id<"users">) => {
    onUserClick(userId);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find Egoists" size="lg">
      <div className="space-y-4">
        <InputField
          label="Search by User ID or Name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter User ID (e.g., ABC12345) or name..."
          className="mb-4"
        />
        
        <div className="text-sm text-muted-foreground mb-4">
          <p>💡 <strong>Tip:</strong> Each Egoist has a unique 8-character ID (like ABC12345) for easy finding!</p>
        </div>

        {debouncedSearchTerm.length < 2 && (
          <p className="text-muted-foreground text-center py-8">
            Enter at least 2 characters to search for Egoists
          </p>
        )}

        {debouncedSearchTerm.length >= 2 && searchResults === undefined && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Searching for Egoists...</p>
          </div>
        )}

        {searchResults && searchResults.length === 0 && debouncedSearchTerm.length >= 2 && (
          <p className="text-muted-foreground text-center py-8">
            No Egoists found matching "{debouncedSearchTerm}"
          </p>
        )}

        {searchResults && searchResults.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <h4 className="font-semibold text-primary">Search Results ({searchResults.length})</h4>
            {searchResults.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-3 bg-input rounded-lg border border-border hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <img 
                    src={user.profileImageUrl ?? '/blue-lock-logo-placeholder.png'} 
                    alt={user.name} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary cursor-pointer"
                    onClick={() => handleUserProfileClick(user._id)}
                  />
                  <div>
                    <p 
                      className="font-semibold text-card-foreground cursor-pointer hover:text-primary"
                      onClick={() => handleUserProfileClick(user._id)}
                    >
                      {user.displayName ?? user.name}
                    </p>
                    {user.uniqueUserId && (
                      <p className="text-sm text-muted-foreground">
                        ID: <span className="font-mono text-accent">{user.uniqueUserId}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleUserProfileClick(user._id)}
                    variant="ghost" 
                    size="sm"
                  >
                    View Profile
                  </Button>
                  <Button 
                    onClick={() => handleSendFriendRequest(user._id, user.displayName ?? user.name)}
                    variant="accent" 
                    size="sm"
                  >
                    Add Friend
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
