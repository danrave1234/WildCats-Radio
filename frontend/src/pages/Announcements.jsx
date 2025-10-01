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
        // PUBLIC endpoint: Always returns ONLY published announcements
        data = await getAllAnnouncements(page, pageSize);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-maroon-600 to-maroon-700 rounded-xl shadow-md">
              <Megaphone className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Announcements</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {isModerator ? 'Manage and moderate community announcements' : 'Stay updated with WildCats Radio'}
              </p>
            </div>
          </div>
          
          {canCreate && (
            <button
              onClick={() => navigate('/announcements/create')}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
            >
              <Plus className="w-5 h-5" />
              New Announcement
            </button>
          )}
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-3 mb-6 overflow-x-auto bg-white dark:bg-gray-800 p-2 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(0);
                }}
                className={`px-5 py-2.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-maroon-600 to-maroon-700 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
          </div>
        ) : (
          <>
            {/* Announcements List */}
            <div className="space-y-6">
              {announcements.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="inline-flex p-6 bg-gray-100 dark:bg-gray-700 rounded-full mb-6">
                    <Megaphone className="w-16 h-16 text-gray-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-xl font-medium mb-2">
                    No announcements {activeTab !== 'published' && `in ${activeTab}`}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    {activeTab === 'my-drafts' && 'You have no draft announcements yet'}
                    {activeTab === 'my-published' && 'You have no published or archived announcements yet'}
                    {activeTab !== 'my-drafts' && activeTab !== 'my-published' && 'Check back later for updates'}
                  </p>
                  {canCreate && activeTab === 'my-drafts' && (
                    <button
                      onClick={() => navigate('/announcements/create')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Create Your First Announcement
                    </button>
                  )}
                </div>
              ) : (
                announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all border border-gray-200 dark:border-gray-700 transform hover:-translate-y-1"
                  >
                    {/* Image - Natural aspect ratio like Facebook */}
                    {announcement.imageUrl && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700">
                        <img
                          src={announcement.imageUrl}
                          alt={announcement.title}
                          className="w-full h-auto object-contain"
                          style={{ maxHeight: '600px' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                              {announcement.title}
                            </h2>
                            {announcement.pinned && (
                              <Pin className="w-5 h-5 text-maroon-600 fill-maroon-600" />
                            )}
                          </div>
                          
                          {/* Status Badge */}
                          {(isModerator || isDJ) && (
                            <div className="flex gap-2 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(announcement.status)}`}>
                                {announcement.status}
                              </span>
                              {announcement.scheduledFor && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(announcement.scheduledFor), 'MMM d, yyyy h:mm a')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 ml-4 flex-wrap">
                          {/* DJ: Edit/Delete DRAFTS only (their own) */}
                          {isDJ && canEditDelete(announcement) && announcement.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleEdit(announcement)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors shadow-sm"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteDraft(announcement)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shadow-sm"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}

                          {/* DJ: Resubmit REJECTED announcements */}
                          {isDJ && announcement.createdById === currentUser?.id && announcement.status === 'REJECTED' && (
                            <>
                              <button
                                onClick={() => handleEdit(announcement)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors shadow-sm"
                                title="Edit & Revise"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleResubmit(announcement.id)}
                                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors shadow-sm"
                                title="Resubmit for Approval"
                              >
                                <Send className="w-5 h-5" />
                              </button>
                            </>
                          )}

                          {/* Moderator/Admin: Full management controls */}
                          {isModerator && (
                            <>
                              {/* DRAFT: Approve, Schedule, or Reject */}
                              {announcement.status === 'DRAFT' && (
                                <>
                                  <button
                                    onClick={() => handleOpenPublish(announcement)}
                                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors shadow-sm"
                                    title="Approve & Publish Now"
                                  >
                                    <Send className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenSchedule(announcement)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors shadow-sm"
                                    title="Schedule for Later"
                                  >
                                    <Calendar className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenReject(announcement)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shadow-sm"
                                    title="Reject with Feedback"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </>
                              )}

                              {/* PUBLISHED: Pin/Unpin, Archive */}
                              {announcement.status === 'PUBLISHED' && (
                                <>
                                  <button
                                    onClick={() => handleTogglePin(announcement)}
                                    className={`p-2 rounded-lg transition-colors shadow-sm ${
                                      announcement.pinned
                                        ? 'text-maroon-600 bg-maroon-50 dark:bg-maroon-900/20 ring-2 ring-maroon-200 dark:ring-maroon-800'
                                        : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                    title={announcement.pinned ? 'Unpin' : 'Pin (max 2)'}
                                  >
                                    {announcement.pinned ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
                                  </button>
                                  <button
                                    onClick={() => handleArchive(announcement.id)}
                                    className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors shadow-sm"
                                    title="Archive"
                                  >
                                    <Archive className="w-5 h-5" />
                                  </button>
                                </>
                              )}

                              {/* SCHEDULED: Delete */}
                              {announcement.status === 'SCHEDULED' && (
                                <button
                                  onClick={() => handleDelete(announcement.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shadow-sm"
                                  title="Delete"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}

                              {/* ARCHIVED: Unarchive or Delete (with confirmation) */}
                              {announcement.status === 'ARCHIVED' && (
                                <>
                                  <button
                                    onClick={() => handleUnarchive(announcement.id)}
                                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors shadow-sm"
                                    title="Restore & Publish"
                                  >
                                    <ArchiveRestore className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenDeleteArchived(announcement)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shadow-sm"
                                    title="Delete Permanently"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">
                        {(announcement.content || '').replace(/\s+$/g, '')}
                      </p>

                      {/* Metadata Footer */}
                      <div className="border-t dark:border-gray-700 pt-4 space-y-3">
                        {/* Created By */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4" />
                            <span>Created by <span className="font-medium text-gray-900 dark:text-white">{announcement.createdByName}</span></span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(announcement.createdAt), 'PPp')}
                          </span>
                        </div>

                        {/* Approval Info (Published - Mods/Admins only) */}
                        {isModerator && announcement.status === 'PUBLISHED' && announcement.approvedByName && (
                          <div className="flex items-center justify-between text-sm bg-green-50 dark:bg-green-900/10 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approved by <span className="font-medium">{announcement.approvedByName}</span></span>
                            </div>
                            {announcement.publishedAt && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                {format(new Date(announcement.publishedAt), 'PPp')}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Rejection Info (Rejected - DJ or Mod/Admin view) */}
                        {announcement.status === 'REJECTED' && announcement.rejectedByName && (
                          <div className="bg-red-50 dark:bg-red-900/10 px-4 py-3 rounded-lg border border-red-200 dark:border-red-800 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <AlertCircle className="w-4 h-4" />
                                <span>Rejected by <span className="font-medium">{announcement.rejectedByName}</span></span>
                              </div>
                              {announcement.rejectedAt && (
                                <span className="text-xs text-red-600 dark:text-red-400">
                                  {format(new Date(announcement.rejectedAt), 'PPp')}
                                </span>
                              )}
                            </div>
                            {announcement.rejectionReason && (
                              <div className="text-sm text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/20 px-3 py-2 rounded border border-red-300 dark:border-red-700">
                                <span className="font-semibold">Reason: </span>
                                {announcement.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Archive Info (Archived - Mods/Admins only) */}
                        {isModerator && announcement.status === 'ARCHIVED' && announcement.archivedByName && (
                          <div className="flex items-center justify-between text-sm bg-gray-100 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Archive className="w-4 h-4" />
                              <span>Archived by <span className="font-medium">{announcement.archivedByName}</span></span>
                            </div>
                            {announcement.archivedAt && (
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {format(new Date(announcement.archivedAt), 'PPp')}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Expiry Warning */}
                        {announcement.expiresAt && announcement.status !== 'ARCHIVED' && (
                          <div className="flex items-center gap-2 text-xs bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-800">
                            <AlertCircle className="w-4 h-4" />
                            <span>Expires: {format(new Date(announcement.expiresAt), 'PPp')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
                
                <span className="text-gray-700 dark:text-gray-300">
                  Page {currentPage + 1} of {totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            )}
          </>
        )}

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
  );
};

export default Announcements;