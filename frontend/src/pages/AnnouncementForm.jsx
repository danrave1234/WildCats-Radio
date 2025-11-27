import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  createAnnouncement, 
  updateAnnouncement, 
  getAnnouncementById,
  scheduleAnnouncement,
  publishAnnouncement 
} from '../services/announcementService';
import { requestAnnouncementImageUploadUrl, putToSignedUrl, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '../services/gcsUpload';
import { maybeDownscaleAndEncode } from '../utils/imageUtils';
import { ArrowLeft, Save, Send, Calendar as CalendarIcon, Image as ImageIcon, FileText, CheckCircle, XCircle, Upload as UploadIcon, Trash2, Pencil } from 'lucide-react';

const AnnouncementForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { currentUser, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    imageUrl: ''
  });

  const [scheduleData, setScheduleData] = useState({
    scheduledFor: '',
    expiresAt: ''
  });

  const [publishOption, setPublishOption] = useState('draft'); // draft, publish, schedule
  const [message, setMessage] = useState({ type: '', text: '' });

  // Image selection state (defer upload until Save)
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const pendingUploadRef = useRef(null); // { blob, contentType, originalName, objectUrl }

  const isDJ = currentUser?.role === 'DJ';
  const isModerator = currentUser?.role === 'MODERATOR' || currentUser?.role === 'ADMIN';
  const isEditing = !!id;

  // Load existing announcement if editing
  useEffect(() => {
    if (isEditing) {
      loadAnnouncement();
    } else if (location.state?.announcement) {
      const ann = location.state.announcement;
      setFormData({
        title: ann.title,
        content: ann.content,
        imageUrl: ann.imageUrl || ''
      });
    }
  }, [id]);

  const loadAnnouncement = async () => {
    try {
      setLoading(true);
      const data = await getAnnouncementById(id);
      setFormData({
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl || ''
      });
    } catch (err) {
      console.error('Error loading announcement:', err);
      setMessage({ type: 'error', text: 'Failed to load announcement.' });
      navigate('/announcements');
    } finally {
      setLoading(false);
    }
  };

  const fileInputRef = useRef(null);

  const handleSelectImageClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Reset input so selecting the same file again triggers change
    e.target.value = '';

    // Basic validations
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setMessage({ type: 'error', text: 'Unsupported image type. Please use JPG, PNG, WebP, or GIF.' });
      return;
    }
    // Hard cap for original file to avoid extreme memory use (e.g., 25MB)
    const HARD_CAP = 25 * 1024 * 1024;
    if (file.size > HARD_CAP) {
      setMessage({ type: 'error', text: 'Image is too large. Please select a file under 25 MB.' });
      return;
    }

    try {
      setIsUploadingImage(true);
      setUploadProgress(0);
      setMessage({ type: '', text: '' });

      // Optional high-quality downscale/encode (but DO NOT upload yet)
      const { blob, contentType } = await maybeDownscaleAndEncode(file);

      if (blob.size > MAX_IMAGE_BYTES) {
        setMessage({ type: 'error', text: 'Image is too large after processing. Please choose a smaller image.' });
        setIsUploadingImage(false);
        return;
      }

      // Prepare local preview and defer upload until Save
      if (pendingUploadRef.current?.objectUrl) {
        URL.revokeObjectURL(pendingUploadRef.current.objectUrl);
      }
      const objectUrl = URL.createObjectURL(blob);
      pendingUploadRef.current = { blob, contentType, originalName: file.name, objectUrl };
      setLocalPreviewUrl(objectUrl);
      // Do not set formData.imageUrl yet; we only set it after a successful upload on Save
      setMessage({ type: 'success', text: 'Image ready. It will be uploaded when you click Save.' });
    } catch (err) {
      console.error('Image processing failed', err);
      setMessage({ type: 'error', text: err?.message || 'Image processing failed. Please try again.' });
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
    if (pendingUploadRef.current?.objectUrl) {
      URL.revokeObjectURL(pendingUploadRef.current.objectUrl);
    }
    pendingUploadRef.current = null;
    setLocalPreviewUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double-submit while a request is in-flight
    if (loading) {
      return;
    }
    if (!isAuthenticated || !currentUser) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);

      // Sanitize inputs: trim title, imageUrl; trim trailing whitespace/newlines for content
      let cleanedData = {
        title: (formData.title || '').trim(),
        content: (formData.content || '').replace(/\s+$/g, ''),
        imageUrl: (formData.imageUrl || '').trim(),
      };

      // If a new image was selected but not yet uploaded, upload now
      if (pendingUploadRef.current && !cleanedData.imageUrl) {
        try {
          setIsUploadingImage(true);
          setUploadProgress(0);
          const { originalName, blob, contentType } = pendingUploadRef.current;
          const signed = await requestAnnouncementImageUploadUrl(originalName || 'image', contentType);
          await putToSignedUrl({
            uploadUrl: signed.uploadUrl,
            blob,
            contentType: signed.requiredContentType || contentType,
            onProgress: ({ percent }) => setUploadProgress(percent)
          });
          cleanedData = { ...cleanedData, imageUrl: signed.publicUrl };
        } catch (uploadErr) {
          console.error('Deferred image upload failed', uploadErr);
          setMessage({ type: 'error', text: uploadErr?.message || 'Image upload failed. Please try again.' });
          setLoading(false);
          setIsUploadingImage(false);
          return;
        } finally {
          setIsUploadingImage(false);
          setUploadProgress(0);
        }
      }

      if (isEditing) {
        // Update existing announcement
        await updateAnnouncement(id, cleanedData);
        navigate('/announcements');
      } else {
        // Create new announcement
        const created = await createAnnouncement(cleanedData);

        // If moderator and wants to publish or schedule
        if (isModerator && publishOption === 'publish') {
          await publishAnnouncement(created.id);
        } else if (isModerator && publishOption === 'schedule') {
          if (!scheduleData.scheduledFor) {
            setMessage({ type: 'error', text: 'Please select a scheduled date/time.' });
            setLoading(false);
            return;
          }
          await scheduleAnnouncement(
            created.id,
            scheduleData.scheduledFor,
            scheduleData.expiresAt || null
          );
        }

        navigate('/announcements');
      }
    } catch (err) {
      console.error('Error saving announcement:', err);
      const errorMsg = err.response?.data || 'Failed to save announcement. Please try again.';
      setMessage({ type: 'error', text: typeof errorMsg === 'string' ? errorMsg : 'Failed to save announcement.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigate('/announcements')}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-700 text-gray-200 hover:text-white hover:border-maroon-400 hover:bg-maroon-900/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-100">
              {isEditing ? 'Edit announcement' : 'New announcement'}
            </h1>
          </div>

          {isDJ && !isEditing && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/40 bg-blue-900/20">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                i
              </div>
              <div className="text-sm text-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <Pencil className="w-4 h-4" />
                  <p className="font-semibold">Draft submission</p>
                </div>
                <p className="text-xs sm:text-sm text-blue-100/90">
                  Your announcement will be saved as a <strong>DRAFT</strong> and sent to moderators for approval before it goes live.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Inline Message Banner */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-l-4 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-50 border-l-4 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <p>{message.text}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Main layout: content left, controls/right-rail on larger screens */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] items-start">
            {/* Main Content Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Gradient Top Bar */}
              <div className="h-2 bg-gradient-to-r from-maroon-600 via-maroon-700 to-maroon-600"></div>
              
              <div className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <FileText className="w-4 h-4 text-maroon-600" />
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={500}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-all"
                    placeholder="Enter a clear and descriptive title"
                    disabled={loading}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Make it clear and attention-grabbing
                    </p>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {formData.title.length} / 500
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <FileText className="w-4 h-4 text-maroon-600" />
                      Content *
                    </label>
                    <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Main body
                    </span>
                  </div>
                  <textarea
                    required
                    maxLength={2000}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={10}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-maroon-500 focus:border-transparent resize-none transition-all"
                    placeholder="Write your announcement content here... Be clear and concise."
                    disabled={loading}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Provide all necessary details
                    </p>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {formData.content.length} / 2000
                    </p>
                  </div>
                </div>

                {/* Image Upload & Preview */}
                <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-maroon-600 to-maroon-700 text-white shadow-sm">
                        <ImageIcon className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          Feature image
                          <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">(optional)</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Add a visual that makes your announcement stand out.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Upload controls */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={handleImageFileChange}
                          disabled={loading || isUploadingImage}
                        />
                        <button
                          type="button"
                          onClick={handleSelectImageClick}
                          disabled={loading || isUploadingImage}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                        >
                          <UploadIcon className="w-4 h-4" />
                          {isUploadingImage ? 'Uploading...' : 'Select image'}
                        </button>
                        {(formData.imageUrl || localPreviewUrl) && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            disabled={loading || isUploadingImage}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                          >
                            <Trash2 className="w-4 h-4" /> Remove image
                          </button>
                        )}
                      </div>

                      {/* Progress bar */}
                      {isUploadingImage && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                          <div
                            className="bg-maroon-600 h-2.5 rounded-full transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}

                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        JPG, PNG, WebP or GIF • Up to 25 MB. The image will be uploaded and attached when you save the announcement.
                      </p>
                    </div>

                    {/* Preview */}
                    {(localPreviewUrl || formData.imageUrl) && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40 p-2 flex items-center justify-center">
                        <img
                          src={localPreviewUrl || formData.imageUrl}
                          alt="Preview"
                          className="max-h-60 w-full object-contain rounded-md"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right rail: publishing options / helper */}
            <div className="space-y-4">
              {isModerator && !isEditing && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border-2 border-blue-200 dark:border-blue-800 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500"></div>
                  <div className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                        <CalendarIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Publishing Options</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Choose how and when to publish this announcement</p>
                      </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-blue-200 dark:via-blue-800 to-transparent"></div>
                    
                    {/* Publishing Mode Selector */}
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-maroon-500 has-[:checked]:bg-maroon-50 dark:has-[:checked]:bg-maroon-900/20">
                        <input
                          type="radio"
                          name="publishOption"
                          value="draft"
                          checked={publishOption === 'draft'}
                          onChange={(e) => setPublishOption(e.target.value)}
                          className="mt-1 w-5 h-5 text-maroon-600 focus:ring-maroon-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Save className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                            <span className="font-semibold text-gray-900 dark:text-white">Save as Draft</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Save for later review before publishing</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-maroon-500 has-[:checked]:bg-maroon-50 dark:has-[:checked]:bg-maroon-900/20">
                        <input
                          type="radio"
                          name="publishOption"
                          value="publish"
                          checked={publishOption === 'publish'}
                          onChange={(e) => setPublishOption(e.target.value)}
                          className="mt-1 w-5 h-5 text-maroon-600 focus:ring-maroon-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Send className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                            <span className="font-semibold text-gray-900 dark:text-white">Publish Immediately</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Make visible to everyone right now</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-maroon-500 has-[:checked]:bg-maroon-50 dark:has-[:checked]:bg-maroon-900/20">
                        <input
                          type="radio"
                          name="publishOption"
                          value="schedule"
                          checked={publishOption === 'schedule'}
                          onChange={(e) => setPublishOption(e.target.value)}
                          className="mt-1 w-5 h-5 text-maroon-600 focus:ring-maroon-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                            <span className="font-semibold text-gray-900 dark:text-white">Schedule for Later</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Auto-publish at a specific date and time</p>
                        </div>
                      </label>
                    </div>

                    {/* Schedule Options Dropdown */}
                    {publishOption === 'schedule' && (
                      <div className="mt-5 p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-2 border-amber-200 dark:border-amber-800 rounded-lg space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                          <CalendarIcon className="w-5 h-5" />
                          <h4 className="font-bold">Schedule Settings</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Publish At *
                            </label>
                            <input
                              type="datetime-local"
                              required={publishOption === 'schedule'}
                              value={scheduleData.scheduledFor}
                              onChange={(e) => setScheduleData({ ...scheduleData, scheduledFor: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                            />
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              The announcement will automatically publish at this time
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Auto-Archive At (optional)
                            </label>
                            <input
                              type="datetime-local"
                              value={scheduleData.expiresAt}
                              onChange={(e) => setScheduleData({ ...scheduleData, expiresAt: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                            />
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              Leave empty for a permanent post, or set a date to automatically archive
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Helper card for everyone */}
              <div className="bg-slate-900/80 text-slate-100 rounded-xl shadow-xl border border-slate-700 p-5 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/10 text-amber-300 border border-amber-500/40 text-xs font-bold">
                    i
                  </span>
                  Writing tips
                </h3>
                <ul className="text-xs space-y-1.5 text-slate-200/80 list-disc list-inside">
                  <li>Lead with the most important detail in the first sentence.</li>
                  <li>Keep it brief and avoid long paragraphs where possible.</li>
                  <li>Mention dates, times, and locations clearly.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl transition-all font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:transform-none text-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {publishOption === 'publish' && <Send className="w-5 h-5" />}
                  {publishOption === 'schedule' && <CalendarIcon className="w-5 h-5" />}
                  {publishOption === 'draft' && <Save className="w-5 h-5" />}
                  <span>
                    {isEditing ? 'Update Announcement' : 
                      publishOption === 'publish' ? 'Create & Publish Now' :
                      publishOption === 'schedule' ? 'Create & Schedule' :
                      isDJ ? 'Submit for Approval' : 'Save as Draft'}
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/announcements')}
              disabled={loading}
              className="px-6 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 disabled:dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl transition-all font-bold shadow-md hover:shadow-lg text-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnnouncementForm;