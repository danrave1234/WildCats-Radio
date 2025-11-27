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
  ChevronUp,
  ChevronDown,
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
  const [publishLoading, setPublishLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingAnnouncement, setRejectingAnnouncement] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Tabs/Filters
  // Default to published for everyone; moderators will be switched to "all" via effect
  const [activeTab, setActiveTab] = useState('published');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize] = useState(10);

  const [scheduleData, setScheduleData] = useState({
    scheduledFor: '',
    expiresAt: ''
  });
  const [expandedAnnouncements, setExpandedAnnouncements] = useState({});

  // Permission checks
  const isDJ = currentUser && currentUser.role === 'DJ';
  const isModerator = currentUser && (currentUser.role === 'MODERATOR' || currentUser.role === 'ADMIN');
  const isListener = currentUser && currentUser.role === 'LISTENER';
  const canCreate = currentUser && ['DJ', 'MODERATOR', 'ADMIN'].includes(currentUser.role);

  // Keep default tab sensible for each role:
  // - Moderators/Admins: use "all"
  // - Others/public: use "published"
  useEffect(() => {
    if (isModerator && activeTab === 'published') {
      setActiveTab('all');
    } else if (!isModerator && activeTab === 'all') {
      setActiveTab('published');
    }
    // Only react to role changes and initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModerator]);

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
        { id: 'all', label: 'All' },
        { id: 'draft', label: 'Pending Drafts' },
        { id: 'published', label: 'Published' },
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
      } else if (activeTab === 'all') {
        // Moderators/Admins: combined view with pending (drafts) first, newest to oldest
        if (!isModerator) {
          setError('Unauthorized access');
          setLoading(false);
          return;
        }

        const [draftRes, publishedRes, scheduledRes] = await Promise.all([
          getAnnouncementsByStatus('DRAFT', 0, pageSize, token),
          getAnnouncementsByStatus('PUBLISHED', 0, pageSize, token),
          getAnnouncementsByStatus('SCHEDULED', 0, pageSize, token)
        ]);

        const combined = [
          ...(draftRes.content || []),
          ...(publishedRes.content || []),
          ...(scheduledRes.content || []),
        ];

        const statusOrder = {
          DRAFT: 0,       // pending
          SCHEDULED: 1,
          PUBLISHED: 2,
          ARCHIVED: 3,
          REJECTED: 4
        };

        combined.sort((a, b) => {
          const orderDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
          if (orderDiff !== 0) return orderDiff;
          const dateA = new Date(a.createdAt || a.publishedAt || 0);
          const dateB = new Date(b.createdAt || b.publishedAt || 0);
          return dateB - dateA; // newest first
        });

        data = {
          content: combined,
          totalPages: 1
        };
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
    setPublishLoading(false);
    setShowPublishModal(true);
  };

  // Confirm publish
  const handleConfirmPublish = async () => {
    if (!publishingAnnouncement || publishLoading) return;

    // Simulate a short loading state in the modal, then close it
    setPublishLoading(true);

    // Fire-and-forget publish in the background
    (async () => {
      try {
        await publishAnnouncement(publishingAnnouncement.id, token);
        fetchAnnouncements(currentPage);
      } catch (err) {
        console.error('Error publishing announcement:', err);
        setError(err.response?.data || 'Failed to publish announcement');
      }
    })();

    // Keep the modal visible briefly to show a loading state, then close it
    setTimeout(() => {
      setShowPublishModal(false);
      setPublishingAnnouncement(null);
      setPublishLoading(false);
    }, 1200);
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

  const toggleExpand = (id) => {
    setExpandedAnnouncements((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getSortedAnnouncements = () => {
    return [...announcements].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const dateA = new Date(a.createdAt || a.publishedAt || 0);
      const dateB = new Date(b.createdAt || b.publishedAt || 0);
      return dateB - dateA;
    });
  };

  const getFeaturedAndPast = () => {
    if (announcements.length === 0) {
      return { featured: null, past: [] };
    }
    const sorted = getSortedAnnouncements();
    return {
      featured: sorted[0],
      past: sorted.slice(1)
    };
  };

  const getTruncatedContent = (text = '', id, limit) => {
    const clean = text.trim();
    if (!clean) return '';
    if (expandedAnnouncements[id] || clean.length <= limit) {
      return clean;
    }
    return `${clean.slice(0, limit).trim()}…`;
  };

  const needsTruncate = (text = '', limit) => text.trim().length > limit;

  // Check if user can edit/delete
  const canEditDelete = (announcement) => {
    if (isModerator) return true;
    if (isDJ && announcement.createdById === currentUser?.id && announcement.status === 'DRAFT') {
      return true;
    }
    return false;
  };

  const isPublishedView = activeTab === 'published';
  const { featured: featuredAnnouncement, past: pastAnnouncements } = isPublishedView
    ? getFeaturedAndPast()
    : { featured: null, past: [] };

  return (
    <>
      <SEO
        title="Announcements"
        description="Latest announcements and news from Wildcat Radio - Cebu Institute of Technology University (CITU). Stay updated with campus events and broadcast schedules."
        keywords="wildcat radio announcements, CITU news, campus radio news, CIT radio updates, university announcements, campus events"
      />
      <div className="min-h-screen text-slate-50 py-10">
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
              <div className="relative">
                <style>{`
                  @keyframes announcement-shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                `}</style>
                {/* Match one-card-per-row layout */}
                <div className="grid grid-cols-1 gap-6">
                  {[...Array(4)].map((_, idx) => (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-5"
                    >
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-500/25 to-transparent"
                          style={{ animation: 'announcement-shimmer 1.4s linear infinite' }}
                        />
                      </div>

                      <div className="relative space-y-4">
                        <div className="h-3 w-24 rounded-full bg-slate-800" />
                        <div className="h-5 w-3/4 rounded-full bg-slate-800" />
                        <div className="h-4 w-1/2 rounded-full bg-slate-800" />
                        <div className="h-32 w-full rounded-2xl bg-slate-800" />
                        <div className="flex gap-2 mt-2">
                          <div className="h-8 w-20 rounded-full bg-slate-800" />
                          <div className="h-8 w-20 rounded-full bg-slate-800" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
              <>
                {isPublishedView ? (
                  <div className="space-y-10">
                    {featuredAnnouncement && (
                      <article className="relative flex flex-col rounded-2xl border border-wildcats-yellow/30 bg-slate-900/90 shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden">
                        <div className="px-6 pt-6 pb-4 border-b border-slate-800/50 bg-gradient-to-r from-slate-950/80 to-slate-900/60">
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {featuredAnnouncement.pinned && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-wildcats-yellow/20 border border-wildcats-yellow/40 text-wildcats-yellow text-[11px] font-bold uppercase tracking-widest">
                                  <Pin className="w-3.5 h-3.5" />
                                  Pinned Announcement
                                </span>
                              )}
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-wildcats-maroon/20 border border-wildcats-maroon/30 text-wildcats-yellow text-[11px] font-bold uppercase tracking-widest">
                                {featuredAnnouncement.category || 'Latest Update'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300 text-sm">
                              <div className="flex items-center gap-1.5 text-slate-200">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {featuredAnnouncement.createdByName}
                              </div>
                              <span className="text-slate-600">•</span>
                              <span>{format(new Date(featuredAnnouncement.createdAt), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
                            {featuredAnnouncement.title}
                          </h2>
                        </div>
                        {featuredAnnouncement.imageUrl && (
                          <div className="w-full bg-black/20 border-b border-slate-800/50">
                            <img
                              src={featuredAnnouncement.imageUrl}
                              alt={featuredAnnouncement.title}
                              className="w-full h-auto max-h-[420px] object-contain mx-auto"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="px-6 py-8">
                          <div className="prose prose-invert max-w-none">
                            <p className="text-slate-200 text-lg leading-relaxed whitespace-pre-line">
                              {getTruncatedContent(featuredAnnouncement.content, featuredAnnouncement.id, 900)}
                            </p>
                          </div>
                          {needsTruncate(featuredAnnouncement.content || '', 900) && (
                            <button
                              onClick={() => toggleExpand(featuredAnnouncement.id)}
                              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-wildcats-yellow hover:text-white transition"
                            >
                              {expandedAnnouncements[featuredAnnouncement.id] ? 'Show Less' : 'Show More'}
                              {expandedAnnouncements[featuredAnnouncement.id] ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </article>
                    )}

                    {pastAnnouncements.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-white">Past Announcements</h3>
                          <span className="text-sm text-slate-400">
                            {pastAnnouncements.length} {pastAnnouncements.length === 1 ? 'update' : 'updates'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {pastAnnouncements.map((announcement) => (
                            <article
                              key={announcement.id}
                              className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-5 flex flex-col gap-4 shadow-lg h-full min-h-[320px]"
                            >
                              <div className="w-full overflow-hidden rounded-xl border border-slate-800/50 bg-black/30 aspect-[16/9] flex items-center justify-center">
                                {announcement.imageUrl ? (
                                  <img
                                    src={announcement.imageUrl}
                                    alt={announcement.title}
                                    className="h-full w-full object-contain"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                                    <Megaphone className="w-10 h-10 text-slate-500" />
                                    <span className="text-xs uppercase tracking-wide">No image provided</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                  <span>{announcement.category || 'Update'}</span>
                                  <span>{format(new Date(announcement.createdAt), 'MMM d')}</span>
                                </div>
                                <h4 className="text-lg font-semibold text-white line-clamp-2">{announcement.title}</h4>
                              </div>
                              <p className="text-sm text-slate-300 whitespace-pre-line flex-1">
                                {getTruncatedContent(announcement.content, announcement.id, 280)}
                              </p>
                              {needsTruncate(announcement.content || '', 280) && (
                                <button
                                  onClick={() => toggleExpand(announcement.id)}
                                  className="text-sm font-semibold text-wildcats-yellow hover:text-white transition self-start"
                                >
                                  {expandedAnnouncements[announcement.id] ? 'Show Less' : 'Show More'}
                                </button>
                              )}
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col space-y-8">
                    {announcements.map((announcement) => (
                      <article
                        key={announcement.id}
                        className="relative flex flex-col rounded-2xl border border-slate-800/60 bg-slate-900/80 shadow-xl backdrop-blur-md transition-all hover:border-wildcats-yellow/30 overflow-hidden"
                      >
                        {/* Header with Category and Meta */}
                        <div className="px-6 pt-6 pb-4 border-b border-slate-800/50 bg-slate-950/20">
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-wildcats-maroon/20 border border-wildcats-maroon/30 text-wildcats-yellow text-xs font-bold uppercase tracking-wider">
                              {announcement.category || 'News / Announcement'}
                            </span>
                            <div className="flex items-center gap-3 text-slate-400 text-sm">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-medium text-slate-300">{announcement.createdByName}</span>
                              </div>
                              <span className="text-slate-600">•</span>
                              <span>{format(new Date(announcement.createdAt), 'MMM d, yyyy')}</span>
                            </div>
                          </div>

                          <h2 className="text-3xl font-bold text-white leading-tight tracking-tight mb-3">
                            {announcement.title}
                          </h2>

                          {/* Status Badges */}
                          <div className="flex flex-wrap gap-2">
                            {isModerator && (
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(announcement.status)}`}>
                                {announcement.status}
                              </span>
                            )}
                            {announcement.scheduledFor && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(announcement.scheduledFor), 'MMM d, h:mm a')}
                              </span>
                            )}
                            {announcement.pinned && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-wildcats-yellow/10 border border-wildcats-yellow/20 text-wildcats-yellow flex items-center gap-1">
                                <Pin className="w-3 h-3" />
                                PINNED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Image Banner */}
                        {announcement.imageUrl && (
                          <div className="w-full bg-black/20 border-b border-slate-800/50">
                            <img
                              src={announcement.imageUrl}
                              alt={announcement.title}
                              className="w-full h-auto max-h-[500px] object-contain mx-auto"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                    {/* Content */}
                        <div className="px-6 py-6">
                          <div className="prose prose-invert max-w-none">
                            <p className="text-slate-300 text-lg leading-relaxed whitespace-pre-line">
                              {(announcement.content || '').trim()}
                            </p>
                          </div>
                        </div>

                        {/* Footer / Actions */}
                        {(isDJ || isModerator) && (
                          <div className="mt-auto px-6 py-4 bg-slate-950/30 border-t border-slate-800/50 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-col gap-1 text-xs">
                               {isModerator && announcement.status === 'PUBLISHED' && announcement.approvedByName && (
                                  <div className="flex items-center gap-1.5 text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Approved by {announcement.approvedByName}</span>
                                  </div>
                               )}
                               {announcement.status === 'REJECTED' && announcement.rejectionReason && (
                                  <div className="text-red-300">
                                    <span className="font-bold">Reason:</span> {announcement.rejectionReason}
                                  </div>
                               )}
                               {announcement.expiresAt && announcement.status !== 'ARCHIVED' && (
                                  <div className="text-amber-200/80 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Expires {format(new Date(announcement.expiresAt), 'PPp')}</span>
                                  </div>
                               )}
                            </div>

                            <div className="flex flex-wrap gap-2 ml-auto">
                              {/* DJ Actions */}
                              {isDJ && canEditDelete(announcement) && announcement.status === 'DRAFT' && (
                                <>
                                  <button
                                    onClick={() => handleEdit(announcement)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition-colors border border-blue-500/10"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleOpenDeleteDraft(announcement)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors border border-red-500/10"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                  </button>
                                </>
                              )}
                              
                              {isDJ && announcement.createdById === currentUser?.id && announcement.status === 'REJECTED' && (
                                <>
                                  <button
                                    onClick={() => handleEdit(announcement)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition-colors border border-blue-500/10"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    Revise
                                  </button>
                                  <button
                                    onClick={() => handleResubmit(announcement.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors border border-emerald-500/10"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Resubmit
                                  </button>
                                </>
                              )}

                              {/* Moderator Actions */}
                              {isModerator && (
                                <>
                                  {announcement.status === 'DRAFT' && (
                                    <>
                                      <button onClick={() => handleOpenPublish(announcement)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/10">
                                        <Send className="w-3.5 h-3.5" /> Publish
                                      </button>
                                      <button onClick={() => handleOpenSchedule(announcement)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/10">
                                        <Calendar className="w-3.5 h-3.5" /> Schedule
                                      </button>
                                      <button onClick={() => handleOpenReject(announcement)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 border border-red-500/10">
                                        <X className="w-3.5 h-3.5" /> Reject
                                      </button>
                                    </>
                                  )}

                                  {announcement.status === 'PUBLISHED' && (
                                    <>
                                      <button onClick={() => handleTogglePin(announcement)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors border ${announcement.pinned ? 'bg-wildcats-yellow/10 border-wildcats-yellow/20 text-wildcats-yellow' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                                        {announcement.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                                        {announcement.pinned ? 'Unpin' : 'Pin'}
                                      </button>
                                      <button onClick={() => handleArchive(announcement.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20 border border-amber-500/10">
                                        <Archive className="w-3.5 h-3.5" /> Archive
                                      </button>
                                    </>
                                  )}

                                  {announcement.status === 'SCHEDULED' && (
                                    <button onClick={() => handleDelete(announcement.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 border border-red-500/10">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  )}

                                  {announcement.status === 'ARCHIVED' && (
                                    <>
                                      <button onClick={() => handleUnarchive(announcement.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/10">
                                        <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                                      </button>
                                      <button onClick={() => handleOpenDeleteArchived(announcement)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 border border-red-500/10">
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
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
                  onClick={() => { if (!publishLoading) { setShowPublishModal(false); setPublishingAnnouncement(null); } }}
                  disabled={publishLoading}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  disabled={publishLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-70 disabled:cursor-wait"
                >
                  {publishLoading ? 'Publishing…' : 'Publish Now'}
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