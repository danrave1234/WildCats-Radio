import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAllAnnouncements,
  getAnnouncementsByStatus,
  getMyAnnouncements,
  deleteAnnouncement,
  publishAnnouncement,
  scheduleAnnouncement,
  pinAnnouncement,
  unpinAnnouncement,
  archiveAnnouncement,
  unarchiveAnnouncement,
  rejectAnnouncement,
  resubmitAnnouncement,
} from '../services/announcementService';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Send,
  Calendar,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Clock,
  X,
  CheckCircle2,
  User,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import SEO from '../components/SEO';

const Announcements = () => {
  const navigate = useNavigate();
  const { token, currentUser } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingAnnouncement, setSchedulingAnnouncement] = useState(null);
  const [showDeleteDraftModal, setShowDeleteDraftModal] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(null); // { id, title }
  const [showDeleteArchivedModal, setShowDeleteArchivedModal] = useState(false);
  const [deletingArchived, setDeletingArchived] = useState(null); // { id, title }
  
  // Confirmation modals for moderator actions
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingAnnouncement, setRejectingAnnouncement] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Tabs/Filters
  const [activeTab, setActiveTab] = useState('published');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize] = useState(10);

  const [scheduleData, setScheduleData] = useState({
    scheduledFor: '',
    expiresAt: ''
  });

  // Permission checks
  const isDJ = currentUser && currentUser.role === 'DJ';
  const isModerator = currentUser && (currentUser.role === 'MODERATOR' || currentUser.role === 'ADMIN');
  const isListener = currentUser && currentUser.role === 'LISTENER';
  const canCreate = currentUser && ['DJ', 'MODERATOR', 'ADMIN'].includes(currentUser.role);

  // Define tabs based on role - SECURITY: Only show non-published content to authorized roles
  const getTabs = () => {
    // PUBLIC and LISTENERS: Can ONLY see published announcements
    if (!currentUser || isListener) {
      return [{ id: 'published', label: 'Announcements' }];
    }
    
    // DJs: Can see published + their own drafts + rejected + my published
    if (isDJ) {
      return [
        { id: 'published', label: 'Published' },
        { id: 'my-drafts', label: 'My Drafts' },
        { id: 'my-published', label: 'My Published' },
        { id: 'rejected', label: 'Rejected' }
      ];
    }
    
    // MODERATORS & ADMINS: Full access to all statuses
    if (isModerator) {
      return [
        { id: 'published', label: 'Published' },
        { id: 'draft', label: 'Pending Drafts' },
        { id: 'scheduled', label: 'Scheduled' },
        { id: 'archived', label: 'Archived' }
      ];
    }
    
    // Fallback: only published
    return [{ id: 'published', label: 'Announcements' }];
  };

  const tabs = getTabs();

  // Fetch announcements based on active tab
  const fetchAnnouncements = async (page = 0) => {
    try {
      setLoading(true);
      let data;

      // SECURITY: Enforce role-based data access
      if (activeTab === 'my-drafts' || activeTab === 'rejected' || activeTab === 'my-published') {
        // DJs only: fetch their own drafts or rejected
        if (!isDJ) {
          setError('Unauthorized access');
          setLoading(false);
          return;
        }
        if (activeTab === 'my-drafts') {
          // Fetch only my DRAFT announcements
          const allMyAnnouncements = await getMyAnnouncements(page, pageSize, token);
          data = {
            ...allMyAnnouncements,
            content: (allMyAnnouncements.content || []).filter(a => a.status === 'DRAFT')
          };
        } else if (activeTab === 'rejected') {
          // Fetch rejected announcements (filter on client side)
          const allMyAnnouncements = await getMyAnnouncements(page, pageSize, token);
          data = {
            ...allMyAnnouncements,
            content: (allMyAnnouncements.content || []).filter(a => a.status === 'REJECTED')
          };
        } else if (activeTab === 'my-published') {
          // Fetch my published + archived announcements (filter client side)
          const allMyAnnouncements = await getMyAnnouncements(page, pageSize, token);
          data = {
            ...allMyAnnouncements,
            content: (allMyAnnouncements.content || []).filter(a => a.status === 'PUBLISHED' || a.status === 'ARCHIVED')
          };
        }
      } else if (activeTab === 'published') {
        // Published: Public for listeners/DJs; full metadata for moderators/admins
        if (isModerator) {
          data = await getAnnouncementsByStatus('PUBLISHED', page, pageSize, token);
        } else {
          data = await getAllAnnouncements(page, pageSize);
        }
      } else {
        // draft, scheduled, archived: MODERATORS/ADMINS ONLY
        if (!isModerator) {
          setError('Unauthorized access');
          setLoading(false);
          return;
        }
        data = await getAnnouncementsByStatus(activeTab.toUpperCase(), page, pageSize, token);
      }

      setAnnouncements(data.content || []);
      setTotalPages(data.totalPages || 0);
      setCurrentPage(page);
      setError(null);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [activeTab]);

  // Handle delete (generic)
  const handleDelete = async (id) => {
    try {
      await deleteAnnouncement(id, token);
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error deleting announcement:', err);
      const errorMsg = err.response?.data || 'Failed to delete announcement';
      setError(typeof errorMsg === 'string' ? errorMsg : 'Failed to delete announcement');
    }
  };

  // Open confirm modal for DRAFT deletion only
  const handleOpenDeleteDraft = (announcement) => {
    setDeletingDraft({ id: announcement.id, title: announcement.title });
    setShowDeleteDraftModal(true);
  };

  const handleConfirmDeleteDraft = async () => {
    if (!deletingDraft) return;
    try {
      await deleteAnnouncement(deletingDraft.id, token);
      setShowDeleteDraftModal(false);
      setDeletingDraft(null);
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error deleting draft:', err);
      setError(err.response?.data || 'Failed to delete draft');
    }
  };

  // Open confirm modal for ARCHIVED deletion only
  const handleOpenDeleteArchived = (announcement) => {
    setDeletingArchived({ id: announcement.id, title: announcement.title });
    setShowDeleteArchivedModal(true);
  };

  const handleConfirmDeleteArchived = async () => {
    if (!deletingArchived) return;
    try {
      await deleteAnnouncement(deletingArchived.id, token);
      setShowDeleteArchivedModal(false);
      setDeletingArchived(null);
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error deleting archived announcement:', err);
      setError(err.response?.data || 'Failed to delete announcement');
    }
  };

  // Handle edit - navigate to edit page
  const handleEdit = (announcement) => {
    navigate(`/announcements/edit/${announcement.id}`, { state: { announcement } });
  };

  // Open publish confirmation modal
  const handleOpenPublish = (announcement) => {
    setPublishingAnnouncement(announcement);
    setShowPublishModal(true);
  };

  // Confirm publish
  const handleConfirmPublish = async () => {
    if (!publishingAnnouncement) return;
    try {
      await publishAnnouncement(publishingAnnouncement.id, token);
      setShowPublishModal(false);
      setPublishingAnnouncement(null);
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error publishing announcement:', err);
      setError(err.response?.data || 'Failed to publish announcement');
    }
  };

  // Open reject modal
  const handleOpenReject = (announcement) => {
    setRejectingAnnouncement(announcement);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  // Confirm reject
  const handleConfirmReject = async () => {
    if (!rejectingAnnouncement || !rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }
    try {
      await rejectAnnouncement(rejectingAnnouncement.id, rejectionReason.trim(), token);
      setShowRejectModal(false);
      setRejectingAnnouncement(null);
      setRejectionReason('');
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error rejecting announcement:', err);
      setError(err.response?.data || 'Failed to reject announcement');
    }
  };

  // Handle resubmit (DJ)
  const handleResubmit = async (id) => {
    try {
      await resubmitAnnouncement(id, token);
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error resubmitting announcement:', err);
      setError(err.response?.data || 'Failed to resubmit announcement');
    }
  };

  // Handle schedule modal
  const handleOpenSchedule = (announcement) => {
    setSchedulingAnnouncement(announcement);
    setScheduleData({ scheduledFor: '', expiresAt: '' });
    setShowScheduleModal(true);
  };

  // Handle schedule submit
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    
    if (!scheduleData.scheduledFor) {
      setError('Please select a scheduled date/time');
      return;
    }

    try {
      await scheduleAnnouncement(
        schedulingAnnouncement.id,
        scheduleData.scheduledFor,
        scheduleData.expiresAt || null,
        token
      );
      setShowScheduleModal(false);
      setSchedulingAnnouncement(null);
      setScheduleData({ scheduledFor: '', expiresAt: '' });
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error scheduling announcement:', err);
      setError(err.response?.data || 'Failed to schedule announcement');
    }
  };

  // Handle pin/unpin
  const handleTogglePin = async (announcement) => {
    try {
      if (announcement.pinned) {
        await unpinAnnouncement(announcement.id, token);
      } else {
        await pinAnnouncement(announcement.id, token);
      }
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error toggling pin:', err);
      setError(err.response?.data || 'Failed to toggle pin');
    }
  };

  // Handle archive
  const handleArchive = async (id) => {
    try {
      await archiveAnnouncement(id, token);
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error archiving announcement:', err);
      setError(err.response?.data || 'Failed to archive announcement');
    }
  };

  // Handle unarchive
  const handleUnarchive = async (id) => {
    try {
      await unarchiveAnnouncement(id, token);
      fetchAnnouncements(currentPage);
    } catch (err) {
      console.error('Error unarchiving announcement:', err);
      setError(err.response?.data || 'Failed to unarchive announcement');
    }
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      fetchAnnouncements(newPage);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return badges[status] || '';
  };

  // Check if user can edit/delete
  const canEditDelete = (announcement) => {
    if (isModerator) return true;
    if (isDJ && announcement.createdById === currentUser?.id && announcement.status === 'DRAFT') {
      return true;
    }
    return false;
  };

  return (
    <>
      <SEO
        title="Announcements"
        description="Latest announcements and news from Wildcat Radio - Cebu Institute of Technology University (CITU). Stay updated with campus events and broadcast schedules."
        keywords="wildcat radio announcements, CITU news, campus radio news, CIT radio updates, university announcements, campus events"
      />
      <div className="min-h-screen bg-slate-950 text-slate-50 py-10">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Manage campus updates, drafts, schedules, and archived notices in one place.
            </div>
            {canCreate && (
              <button
                onClick={() => navigate('/announcements/create')}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-maroon-900 px-4 py-2 font-semibold shadow-lg hover:shadow-xl transition hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                New Announcement
              </button>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 space-y-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            {tabs.length > 1 && (
              <div className="flex flex-wrap items-center gap-3">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setCurrentPage(0);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        active ? 'bg-white text-maroon-700 shadow-lg' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 rounded-2xl">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="h-48 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-10 text-center shadow-inner">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center">
                  <Megaphone className="h-8 w-8 text-slate-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  No announcements {activeTab !== 'published' && `in ${activeTab}`}
                </h2>
                <p className="text-slate-300 max-w-md mx-auto">
                  {activeTab === 'my-drafts'
                    ? 'Your creative canvas is empty. Start crafting the next big update!'
                    : 'Check back later for fresh campus broadcasts.'}
                </p>
                {canCreate && activeTab === 'my-drafts' && (
                  <button
                    onClick={() => navigate('/announcements/create')}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-maroon-900 font-semibold shadow-lg hover:shadow-xl transition"
                  >
                    <Plus className="w-4 h-4" />
                    Create Announcement
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="group relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg backdrop-blur hover:-translate-y-1 hover:border-amber-400/40 transition"
                  >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {announcement.category || 'Broadcast'}
                      </p>
                      <h2 className="text-2xl font-semibold text-white break-words">
                        {announcement.title}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(announcement.status)}`}>
                        {announcement.status}
                      </span>
                      {announcement.scheduledFor && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-200 border border-blue-400/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(announcement.scheduledFor), 'MMM d, h:mm a')}
                        </span>
                      )}
                      {announcement.pinned && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-200 flex items-center gap-1">
                          <Pin className="w-3 h-3" />
                          Pinned
                        </span>
                      )}
                    </div>
                  </div>

                  {announcement.imageUrl && (
                    <div className="mt-4 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/40">
                      <img
                        src={announcement.imageUrl}
                        alt={announcement.title}
                        className="w-full object-cover max-h-60"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <p className="mt-4 text-slate-200 whitespace-pre-line leading-relaxed">
                    {(announcement.content || '').trim()}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {/* DJ: Edit/Delete DRAFTS only (their own) */}
                    {isDJ && canEditDelete(announcement) && announcement.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-200 hover:bg-blue-500/20"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenDeleteDraft(announcement)}
                          className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}

                    {/* DJ: Resubmit REJECTED announcements */}
                    {isDJ && announcement.createdById === currentUser?.id && announcement.status === 'REJECTED' && (
                      <>
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-200 hover:bg-blue-500/20"
                        >
                          <Edit className="w-4 h-4" />
                          Revise
                        </button>
                        <button
                          onClick={() => handleResubmit(announcement.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
                        >
                          <Send className="w-4 h-4" />
                          Resubmit
                        </button>
                      </>
                    )}

                    {/* Moderator/Admin: Full management controls */}
                    {isModerator && (
                      <>
                        {announcement.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleOpenPublish(announcement)}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
                            >
                              <Send className="w-4 h-4" />
                              Publish
                            </button>
                            <button
                              onClick={() => handleOpenSchedule(announcement)}
                              className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20"
                            >
                              <Calendar className="w-4 h-4" />
                              Schedule
                            </button>
                            <button
                              onClick={() => handleOpenReject(announcement)}
                              className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </>
                        )}

                        {announcement.status === 'PUBLISHED' && (
                          <>
                            <button
                              onClick={() => handleTogglePin(announcement)}
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                                announcement.pinned
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              {announcement.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                              {announcement.pinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button
                              onClick={() => handleArchive(announcement.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                            >
                              <Archive className="w-4 h-4" />
                              Archive
                            </button>
                          </>
                        )}

                        {announcement.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}

                        {announcement.status === 'ARCHIVED' && (
                          <>
                            <button
                              onClick={() => handleUnarchive(announcement.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                              Restore
                            </button>
                            <button
                              onClick={() => handleOpenDeleteArchived(announcement)}
                              className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800 text-sm text-slate-400 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span className="text-slate-200">{announcement.createdByName}</span>
                      </div>
                      <span>{format(new Date(announcement.createdAt), 'PPp')}</span>
                    </div>

                    {isModerator && announcement.status === 'PUBLISHED' && announcement.approvedByName && (
                      <div className="flex flex-wrap items-center gap-2 justify-between text-emerald-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approved by {announcement.approvedByName}</span>
                        </div>
                        {announcement.publishedAt && <span>{format(new Date(announcement.publishedAt), 'PPp')}</span>}
                      </div>
                    )}

                    {announcement.status === 'REJECTED' && announcement.rejectionReason && (
                      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3 text-red-200">
                        <p className="text-xs uppercase tracking-wide mb-1">Rejection reason</p>
                        {announcement.rejectionReason}
                      </div>
                    )}

                    {announcement.expiresAt && announcement.status !== 'ARCHIVED' && (
                      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-100 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Expires {format(new Date(announcement.expiresAt), 'PPp')}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-800 px-4 py-2 text-slate-200 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-slate-300">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-800 px-4 py-2 text-slate-200 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        {/* Schedule Modal (Moderators only) */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Schedule Announcement
                </h2>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Publish At *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleData.scheduledFor}
                    onChange={(e) => setScheduleData({ ...scheduleData, scheduledFor: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Auto-Archive At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleData.expiresAt}
                    onChange={(e) => setScheduleData({ ...scheduleData, expiresAt: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Leave empty for permanent post
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Draft Confirmation Modal */}
        {showDeleteDraftModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="border-b dark:border-gray-700 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Draft</h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                <p className="text-gray-800 dark:text-gray-200">
                  Are you sure you want to delete this draft post?
                </p>
                {deletingDraft?.title && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    "{deletingDraft.title}"
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-3 justify-end border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowDeleteDraftModal(false); setDeletingDraft(null); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteDraft}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Publish Confirmation Modal */}
        {showPublishModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="border-b dark:border-gray-700 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Publish Announcement</h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                <p className="text-gray-800 dark:text-gray-200">
                  Are you sure you want to publish this announcement?
                </p>
                {publishingAnnouncement?.title && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    "{publishingAnnouncement.title}"
                  </p>
                )}
                <p className="text-sm text-green-700 dark:text-green-400">
                  ✓ This will make it visible to everyone immediately.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-3 justify-end border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowPublishModal(false); setPublishingAnnouncement(null); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Publish Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Confirmation Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
              <div className="border-b dark:border-gray-700 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reject Announcement</h2>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-gray-800 dark:text-gray-200">
                  Please provide feedback for the DJ on why this announcement is being rejected.
                </p>
                {rejectingAnnouncement?.title && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    "{rejectingAnnouncement.title}"
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    placeholder="e.g., Content needs more details, image is inappropriate, etc."
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {rejectionReason.length} / 500 characters
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 flex gap-3 justify-end border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowRejectModal(false); setRejectingAnnouncement(null); setRejectionReason(''); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={!rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  Reject with Feedback
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Archived Confirmation Modal */}
        {showDeleteArchivedModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="border-b dark:border-gray-700 px-6 py-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Archived Announcement</h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                <p className="text-gray-800 dark:text-gray-200">
                  Are you sure you want to permanently delete this archived announcement?
                </p>
                {deletingArchived?.title && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    "{deletingArchived.title}"
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-3 justify-end border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowDeleteArchivedModal(false); setDeletingArchived(null); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteArchived}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
};

export default Announcements;