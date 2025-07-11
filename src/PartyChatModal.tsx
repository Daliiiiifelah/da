import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id, Doc } from '../convex/_generated/dataModel';
import { Toaster, toast } from "sonner";

// --- Reusable Components (Copied from App.tsx for consistency, consider moving to a shared file) ---
const Button = ({ onClick, children, className = "", disabled = false, variant = "primary", type, size }: { onClick?: () => void; children: React.ReactNode; className?: string; disabled?: boolean; variant?: "primary" | "secondary" | "danger" | "ghost" | "accent"; type?: "button" | "submit" | "reset", size?: "sm" | "md" }) => {
  const baseStyle = "px-4 py-2 rounded font-semibold shadow-sm hover:shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
  }
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "bg-transparent text-primary hover:bg-primary/10",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  };
  return <button type={type} onClick={onClick} className={`${baseStyle} ${sizes[size ?? 'md']} ${variants[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

const InputField = ({ label, type = "text", value, onChange, placeholder, required = false, className = "", onKeyPress }: { label?: string; type?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean; className?: string; onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void; }) => (
  <div className={`mb-0 ${className}`}> {/* Changed mb-4 to mb-0 for tighter layout in chat */}
    {label && <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} onKeyPress={onKeyPress} className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground placeholder-muted-foreground" />
  </div>
);

const TextareaField = ({ label, value, onChange, placeholder, required = false, className = "" }: { label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; required?: boolean; className?: string; }) => (
  <div className={`mb-4 ${className}`}>
    {label && <label className="block text-sm font-medium text-muted-foreground mb-1">{label}</label>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} required={required} rows={3} className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground placeholder-muted-foreground" />
  </div>
);

const Modal = ({ isOpen, onClose, title, children, size = "md", contentClassName = "" }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; contentClassName?: string; }) => {
  if (!isOpen) return null;
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`bg-card shadow-xl w-full ${sizeClasses[size]} rounded-lg flex flex-col max-h-[80vh]`}>
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h3 className="text-xl font-semibold text-primary">{title}</h3>
          <Button onClick={onClose} variant="ghost" className="text-muted-foreground hover:text-card-foreground p-1 text-2xl">&times;</Button>
        </div>
        <div className={`p-4 overflow-y-auto ${contentClassName}`}>
         {children}
        </div>
      </div>
    </div>
  );
};
// --- End Reusable Components ---

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.data?.message) return error.data.message;
  if (error?.data?.details) return error.data.details;
  if (error?.message) return error.message;
  return "An unknown error occurred.";
}

type ChatMessageWithAuthor = Doc<"chatMessages"> & { authorName: string, authorProfileImageUrl: string | null };

function ReportUserModal({ isOpen, onClose, reportedUserId, reportedUserName, matchId }: { 
  isOpen: boolean; 
  onClose: () => void; 
  reportedUserId: Id<"users">; 
  reportedUserName: string;
  matchId: Id<"matches">;
}) {
  const [category, setCategory] = useState<"violence" | "bad_words" | "match_absence" | "spam" | "other">("bad_words");
  const [description, setDescription] = useState("");
  const submitReport = useMutation(api.reports.submitReport);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await submitReport({
        reportedUserId,
        category,
        description: description.trim() || undefined,
        matchId,
      });
      toast.success("Report submitted successfully. Thank you for keeping the community safe!");
      onClose();
      setDescription("");
      setCategory("bad_words");
    } catch (error: any) {
      toast.error(`Failed to submit report: ${getErrorMessage(error)}`);
    }
  };

  const handleClose = () => {
    onClose();
    setDescription("");
    setCategory("bad_words");
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Report ${reportedUserName}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Reason for Report</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground"
          >
            <option value="bad_words">Inappropriate Language</option>
            <option value="violence">Threats or Violence</option>
            <option value="spam">Spam or Harassment</option>
            <option value="match_absence">Match-Related Issues</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <TextareaField
          label="Additional Details (Optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide any additional context about this report..."
        />
        
        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={handleClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="danger" className="flex-1">
            Submit Report
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InviteFriendsModal({ isOpen, onClose, matchId, availableFriends }: {
  isOpen: boolean;
  onClose: () => void;
  matchId: Id<"matches">;
  availableFriends: any[];
}) {
  const [selectedFriendId, setSelectedFriendId] = useState<Id<"users"> | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const sendInvitation = useMutation(api.partyInvitations.sendPartyInvitation);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFriendId) {
      toast.error("Please select a friend to invite.");
      return;
    }

    try {
      await sendInvitation({
        matchId,
        inviteeId: selectedFriendId,
        message: inviteMessage.trim() || undefined,
      });
      toast.success("Party invitation sent!");
      onClose();
      setSelectedFriendId(null);
      setInviteMessage("");
    } catch (error: any) {
      toast.error(`Failed to send invitation: ${getErrorMessage(error)}`);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedFriendId(null);
    setInviteMessage("");
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Friends to Party" size="md">
      {availableFriends.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No friends available to invite.</p>
          <p className="text-sm text-muted-foreground">Either all your friends are already in this party, or you haven't added any friends yet.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Select Friend</label>
            <select
              value={selectedFriendId || ""}
              onChange={(e) => setSelectedFriendId(e.target.value as Id<"users"> || null)}
              className="w-full px-3 py-2 rounded border bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow shadow-sm hover:shadow-md text-card-foreground"
              required
            >
              <option value="">Choose a friend...</option>
              {availableFriends.map((friend) => (
                <option key={friend._id} value={friend._id}>
                  {friend.displayName || friend.name}
                </option>
              ))}
            </select>
          </div>

          <TextareaField
            label="Invitation Message (Optional)"
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Add a personal message to your invitation..."
          />

          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={handleClose} variant="secondary" className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Send Invitation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function PartyChatModal({ isOpen, onClose, matchId, matchName }: { isOpen: boolean; onClose: () => void; matchId: Id<"matches">; matchName: string }) {
  const messages = useQuery(api.chat.listMessages, matchId ? { matchId } : "skip") || [];
  const matchDetails = useQuery(api.matches.getMatchDetails, matchId ? { matchId } : "skip");
  const myFriends = useQuery(api.friends.listFriends, {});
  const sendMessageMutation = useMutation(api.chat.sendMessage);
  const [newMessage, setNewMessage] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingUserId, setReportingUserId] = useState<Id<"users"> | null>(null);
  const [reportingUserName, setReportingUserName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loggedInUser = useQuery(api.auth.loggedInUser);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (newMessage.trim() === "") return;
    try {
      await sendMessageMutation({ matchId, messageText: newMessage });
      setNewMessage("");
    } catch (error) {
      toast.error(`Failed to send message: ${getErrorMessage(error)}`);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReportUser = (userId: Id<"users">, userName: string) => {
    if (userId === loggedInUser?._id) {
      toast.error("You cannot report yourself.");
      return;
    }
    setReportingUserId(userId);
    setReportingUserName(userName);
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setReportingUserId(null);
    setReportingUserName("");
  };

  // Get available friends to invite (not already in party)
  const availableFriends = myFriends?.filter(friend => {
    const isAlreadyParticipant = matchDetails?.participants?.some(p => p.userId === friend._id);
    const isCreator = matchDetails?.creatorId === friend._id;
    return !isAlreadyParticipant && !isCreator;
  }) || [];

  if (!matchId) return null;
  const partyName = matchDetails?.partyName || matchName;

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={`Party Chat: ${partyName}`} size="lg" contentClassName="flex flex-col">
      <div className="flex-grow space-y-3 mb-4 overflow-y-auto pr-2 min-h-[300px] max-h-[50vh]">
        {messages.length === 0 && <p className="text-muted-foreground text-center py-4">No messages yet. Be the first to unleash your ego!</p>}
        {messages.map((msg: ChatMessageWithAuthor) => (
          <div key={msg._id} className={`flex items-start gap-2.5 ${msg.userId === loggedInUser?._id ? 'justify-end' : ''}`}>
            {msg.userId !== loggedInUser?._id && (
                <img className="w-8 h-8 rounded-full object-cover border border-primary" src={msg.authorProfileImageUrl ?? "/blue-lock-logo-placeholder.png"} alt={msg.authorName} />
            )}
            <div className={`flex flex-col w-full max-w-[320px] leading-1.5 p-3 border-border rounded-xl relative group ${msg.userId === loggedInUser?._id ? 'bg-primary text-primary-foreground rounded-ee-none' : 'bg-muted text-card-foreground rounded-es-none'}`}>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <span className={`text-sm font-semibold ${msg.userId === loggedInUser?._id ? 'text-primary-foreground' : 'text-text-blue-accent'}`}>{msg.authorName}</span>
                <span className={`text-xs font-normal ${msg.userId === loggedInUser?._id ? 'text-blue-200' : 'text-muted-foreground/80'}`}>{new Date(msg._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm font-normal py-1.5">{msg.messageText}</p>
              
              {/* Report button - only show for other users' messages */}
              {msg.userId !== loggedInUser?._id && (
                <button
                  onClick={() => handleReportUser(msg.userId, msg.authorName)}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  title="Report this user"
                >
                  ⚠️
                </button>
              )}
            </div>
            {msg.userId === loggedInUser?._id && (
                <img className="w-8 h-8 rounded-full object-cover border border-secondary" src={msg.authorProfileImageUrl ?? "/blue-lock-logo-placeholder.png"} alt={msg.authorName} />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2 border-t border-border">
        <InputField
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message, Egoist..."
          className="flex-grow"
        />
        <Button type="submit" variant="accent" size="md" disabled={!newMessage.trim()}>Send</Button>
        <Button type="button" variant="ghost" size="md" onClick={() => setShowInviteModal(true)}>
          Invite Friends
        </Button>
      </form>
    </Modal>

    {/* Invite Friends Modal */}
    <InviteFriendsModal
      isOpen={showInviteModal}
      onClose={() => setShowInviteModal(false)}
      matchId={matchId}
      availableFriends={availableFriends}
    />

    {/* Report User Modal */}
    {showReportModal && reportingUserId && (
      <ReportUserModal
        isOpen={showReportModal}
        onClose={handleCloseReportModal}
        reportedUserId={reportingUserId}
        reportedUserName={reportingUserName}
        matchId={matchId}
      />
    )}
    </>
  );
}
