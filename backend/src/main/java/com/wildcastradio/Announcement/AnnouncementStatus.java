package com.wildcastradio.Announcement;

public enum AnnouncementStatus {
    DRAFT,      // Created by DJ, not visible to public
    REJECTED,   // Rejected by moderator, needs revision
    SCHEDULED,  // Approved and scheduled for future publication
    PUBLISHED,  // Live and visible to everyone
    ARCHIVED    // Hidden from public, kept for history
}