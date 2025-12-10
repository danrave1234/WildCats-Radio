package com.wildcastradio.ChatMessage;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.ChatMessage.DTO.ChatMessageDTO;
import com.wildcastradio.Moderation.ModeratorActionEntity;
import com.wildcastradio.Moderation.ModeratorActionService;
import com.wildcastradio.Moderation.StrikeEventEntity;
import com.wildcastradio.Moderation.StrikeService;
import com.wildcastradio.User.UserEntity;

@Service
public class ChatMessageService {

    private static final Logger logger = LoggerFactory.getLogger(ChatMessageService.class);

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private BroadcastRepository broadcastRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private ProfanityService profanityService;
    
    @Autowired
    private StrikeService strikeService;
    
    @Autowired
    private ModeratorActionService moderatorActionService;

    // ... existing methods ...
    
    public List<ChatMessageDTO> getMessagesForBroadcast(Long broadcastId) {
        List<ChatMessageEntity> messages = chatMessageRepository.findByBroadcast_IdOrderByCreatedAtAsc(broadcastId);
        return messages.stream()
                .map(ChatMessageDTO::fromEntity)
                .collect(Collectors.toList());
    }

	public ChatMessageEntity createMessage(Long broadcastId, UserEntity sender, String content) {
        if (content == null || content.length() > 1500) {
            throw new IllegalArgumentException("Message content must not be null and must not exceed 1500 characters");
        }

        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
            .orElseThrow(() -> new IllegalArgumentException("Broadcast not found: " + broadcastId));

		String sanitized = profanityService.processContent(content, sender, broadcastId);

		ChatMessageEntity message = new ChatMessageEntity(broadcast, sender, sanitized);
		message.setOriginalContent(content);
        ChatMessageEntity savedMessage = chatMessageRepository.save(message);

        ChatMessageDTO messageDTO = ChatMessageDTO.fromEntity(savedMessage);

        logger.debug("Broadcasting chat message to /topic/broadcast/{}/chat", broadcastId);
        logger.debug("Message sender: {}", messageDTO.getSender() != null ? messageDTO.getSender().getEmail() : "null");
        
        messagingTemplate.convertAndSend(
                "/topic/broadcast/" + broadcastId + "/chat",
                messageDTO
        );

        return savedMessage;
    }

    // Analytics methods
    public long getTotalMessageCount() { return chatMessageRepository.count(); }
    public double getAverageMessagesPerBroadcast() {
        long totalMessages = getTotalMessageCount();
        long totalBroadcasts = broadcastRepository.count();
        return totalBroadcasts == 0 ? 0.0 : (double) totalMessages / totalBroadcasts;
    }
    public ChatMessageRepository getRepository() { return chatMessageRepository; }

    @Transactional
    public int cleanupOldMessages() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(7);
        long messagesToDelete = chatMessageRepository.countByCreatedAtBefore(cutoffDate);
        if (messagesToDelete > 0) {
            logger.info("Starting cleanup of {} messages older than {}", messagesToDelete, cutoffDate);
            int deletedCount = chatMessageRepository.deleteByCreatedAtBefore(cutoffDate);
            logger.info("Successfully deleted {} old chat messages", deletedCount);
            return deletedCount;
        } else {
            logger.debug("No old messages found for cleanup");
            return 0;
        }
    }

    public List<ChatMessageEntity> getMessagesForExport(Long broadcastId) {
        return chatMessageRepository.findByBroadcast_IdOrderByCreatedAtAsc(broadcastId);
    }

    public long getOldMessagesCount() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(7);
        return chatMessageRepository.countByCreatedAtBefore(cutoffDate);
    }

    /**
     * Export messages to byte array (Legacy) - Keeping simple for now, recommend using stream version
     */
    public byte[] exportMessagesToExcel(Long broadcastId) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        streamMessagesToExcel(broadcastId, outputStream);
        return outputStream.toByteArray();
    }

	/**
	 * Stream messages for a specific broadcast directly to an OutputStream in Excel format.
	 * Includes Moderation Sheets.
	 */
	public void streamMessagesToExcel(Long broadcastId, OutputStream outputStream) throws IOException {
		BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
			.orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));

		SXSSFWorkbook workbook = new SXSSFWorkbook(100);
		
		// 1. Chat Messages Sheet
		SXSSFSheet sheet = workbook.createSheet("Chat Messages");

		CellStyle headerStyle = workbook.createCellStyle();
		Font headerFont = workbook.createFont();
		headerFont.setBold(true);
		headerStyle.setFont(headerFont);

		CellStyle censoredStyle = workbook.createCellStyle();
		censoredStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
		censoredStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

		Row headerRow = sheet.createRow(0);
		String[] headers = {"Sender Name", "Sender Email", "Message Content", "Timestamp"};
		for (int i = 0; i < headers.length; i++) {
			Cell cell = headerRow.createCell(i);
			cell.setCellValue(headers[i]);
			cell.setCellStyle(headerStyle);
		}

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        int rowNum = 1;
        int page = 0;
        int pageSize = 5000;
        Page<ChatMessageEntity> pageResult;
        String replacement = ProfanityFilter.getReplacementPhrase();

        // Aggregation for Analytics sheet
        java.util.Map<String, Integer> senderCounts = new java.util.HashMap<>();
        java.util.Map<String, String> senderNameByEmail = new java.util.HashMap<>();
        java.util.Set<Long> uniqueSenderIds = new java.util.HashSet<>();
        java.util.Map<Long, com.wildcastradio.User.UserEntity> senderById = new java.util.HashMap<>();

		do {
			Pageable pageable = PageRequest.of(page, pageSize);
			pageResult = chatMessageRepository.findByBroadcast_IdOrderByCreatedAtAsc(broadcastId, pageable);
			for (ChatMessageEntity message : pageResult.getContent()) {
				Row row = sheet.createRow(rowNum++);
				row.createCell(0).setCellValue(message.getSender().getDisplayNameOrFullName());
				row.createCell(1).setCellValue(message.getSender().getEmail());
				boolean isCensored = message.getContent() != null && message.getContent().equals(replacement);
				String original = message.getOriginalContent();
				String valueToWrite = (isCensored && original != null && !original.isBlank()) ? original : message.getContent();
				Cell messageCell = row.createCell(2);
				messageCell.setCellValue(valueToWrite);
				if (isCensored) {
					messageCell.setCellStyle(censoredStyle);
				}
                row.createCell(3).setCellValue(message.getCreatedAt().format(formatter));

                if (message.getSender() != null) {
                    uniqueSenderIds.add(message.getSender().getId());
                    senderById.put(message.getSender().getId(), message.getSender());
                    String email = message.getSender().getEmail();
                    senderNameByEmail.put(email, message.getSender().getDisplayNameOrFullName());
                    senderCounts.put(email, senderCounts.getOrDefault(email, 0) + 1);
                }
            }
            page++;
        } while (!pageResult.isLast());

		sheet.trackAllColumnsForAutoSizing();
		for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);

        // 2. Broadcast Info Sheet
		Sheet infoSheet = workbook.createSheet("Broadcast Info");
		// ... existing info rows ...
		int infoRow = 0;
		addInfoRow(infoSheet, infoRow++, "Broadcast Title:", broadcast.getTitle());
		addInfoRow(infoSheet, infoRow++, "Description:", broadcast.getDescription() != null ? broadcast.getDescription() : "N/A");
		addInfoRow(infoSheet, infoRow++, "Created By:", broadcast.getCreatedBy().getDisplayNameOrFullName());
		addInfoRow(infoSheet, infoRow++, "Total Messages:", String.valueOf(rowNum - 1));
        
        String startStr = broadcast.getActualStart() != null ? broadcast.getActualStart().format(formatter) : "N/A";
        String endStr = broadcast.getActualEnd() != null ? broadcast.getActualEnd().format(formatter) : "N/A";
		addInfoRow(infoSheet, infoRow++, "Start Time:", startStr);
		addInfoRow(infoSheet, infoRow++, "End Time:", endStr);
		
		addInfoRow(infoSheet, infoRow++, "Exported At:", LocalDateTime.now().format(formatter));
		addInfoRow(infoSheet, infoRow++, "Legend:", "Yellow cell in Message Content = message was censored");

		if (infoSheet instanceof SXSSFSheet) ((SXSSFSheet) infoSheet).trackAllColumnsForAutoSizing();
        infoSheet.autoSizeColumn(0);
        infoSheet.autoSizeColumn(1);

        // 3. Analytics Sheet (Existing)
        Sheet analyticsSheet = workbook.createSheet("Analytics");
        fillAnalyticsSheet(analyticsSheet, rowNum - 1, uniqueSenderIds, broadcast, senderCounts, senderNameByEmail, senderById);
        
        // 4. Moderation - Strikes Sheet (New)
        try {
            Sheet strikeSheet = workbook.createSheet("Strikes");
            Row sHdr = strikeSheet.createRow(0);
            String[] sHeaders = {"Time", "User", "Email", "Level", "Reason", "Moderator"};
            for(int i=0; i<sHeaders.length; i++) {
                Cell c = sHdr.createCell(i); c.setCellValue(sHeaders[i]); c.setCellStyle(headerStyle);
            }
            
            List<StrikeEventEntity> strikes = strikeService.getBroadcastStrikes(broadcastId);
            int sRow = 1;
            for(StrikeEventEntity s : strikes) {
                Row r = strikeSheet.createRow(sRow++);
                r.createCell(0).setCellValue(s.getCreatedAt().format(formatter));
                r.createCell(1).setCellValue(s.getUser().getDisplayNameOrFullName());
                r.createCell(2).setCellValue(s.getUser().getEmail());
                r.createCell(3).setCellValue(s.getStrikeLevel());
                r.createCell(4).setCellValue(s.getReason());
                r.createCell(5).setCellValue(s.getCreatedBy() != null ? s.getCreatedBy().getDisplayNameOrFullName() : "System");
            }
            if (strikeSheet instanceof SXSSFSheet) ((SXSSFSheet) strikeSheet).trackAllColumnsForAutoSizing();
            for(int i=0; i<sHeaders.length; i++) strikeSheet.autoSizeColumn(i);
        } catch(Exception e) {
            logger.error("Error generating strikes sheet", e);
        }

        // 5. Moderation - Actions Sheet (New)
        try {
            Sheet modSheet = workbook.createSheet("Moderator Actions");
            Row mHdr = modSheet.createRow(0);
            String[] mHeaders = {"Time", "Moderator", "Action", "Target User", "Details"};
            for(int i=0; i<mHeaders.length; i++) {
                Cell c = mHdr.createCell(i); c.setCellValue(mHeaders[i]); c.setCellStyle(headerStyle);
            }
            
            List<ModeratorActionEntity> actions = moderatorActionService.getActionsForBroadcast(broadcastId);
            int mRow = 1;
            for(ModeratorActionEntity a : actions) {
                Row r = modSheet.createRow(mRow++);
                r.createCell(0).setCellValue(a.getCreatedAt().format(formatter));
                r.createCell(1).setCellValue(a.getModerator() != null ? a.getModerator().getDisplayNameOrFullName() : "System");
                r.createCell(2).setCellValue(a.getActionType());
                r.createCell(3).setCellValue(a.getTargetUser() != null ? a.getTargetUser().getDisplayNameOrFullName() : "N/A");
                r.createCell(4).setCellValue(a.getDetails());
            }
            if (modSheet instanceof SXSSFSheet) ((SXSSFSheet) modSheet).trackAllColumnsForAutoSizing();
            for(int i=0; i<mHeaders.length; i++) modSheet.autoSizeColumn(i);
        } catch(Exception e) {
            logger.error("Error generating moderator actions sheet", e);
        }

        try {
            workbook.write(outputStream);
            logger.info("Successfully exported chat for broadcast {}", broadcastId);
        } finally {
            workbook.dispose();
            workbook.close();
        }
	}
    
    private void addInfoRow(Sheet sheet, int rowNum, String label, String value) {
        Row row = sheet.createRow(rowNum);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value);
    }
    
    private void fillAnalyticsSheet(Sheet analyticsSheet, int totalMessages, java.util.Set<Long> uniqueSenderIds, BroadcastEntity broadcast, 
            java.util.Map<String, Integer> senderCounts, java.util.Map<String, String> senderNameByEmail, java.util.Map<Long, com.wildcastradio.User.UserEntity> senderById) {
        
        int aRow = 0;
        Row a1 = analyticsSheet.createRow(aRow++);
        a1.createCell(0).setCellValue("Total Messages:");
        a1.createCell(1).setCellValue(totalMessages);

        Row a2 = analyticsSheet.createRow(aRow++);
        a2.createCell(0).setCellValue("Unique Senders:");
        a2.createCell(1).setCellValue(uniqueSenderIds.size());

        Long durationMinutes = null;
        if (broadcast.getActualStart() != null && broadcast.getActualEnd() != null) {
            durationMinutes = java.time.Duration.between(broadcast.getActualStart(), broadcast.getActualEnd()).toMinutes();
        }
        Row a3 = analyticsSheet.createRow(aRow++);
        a3.createCell(0).setCellValue("Duration (minutes):");
        a3.createCell(1).setCellValue(durationMinutes != null ? durationMinutes : 0);
        
        // ... (rest of analytics logic preserved conceptually, just simplified call structure) ...
        // I will copy the rest of logic here to ensure it works
        
        Row a4 = analyticsSheet.createRow(aRow++);
        a4.createCell(0).setCellValue("Messages per minute:");
        double mpm = (durationMinutes != null && durationMinutes > 0) ? (double) totalMessages / durationMinutes : 0.0;
        a4.createCell(1).setCellValue(mpm);

        // Demographics
        java.util.Map<String, Integer> ageGroups = new java.util.HashMap<>();
        java.util.Map<String, Integer> genders = new java.util.HashMap<>();
        String[] ageKeys = {"teens","youngAdults","adults","middleAged","seniors","unknown"};
        for (String k : ageKeys) ageGroups.put(k, 0);
        String[] genderKeys = {"male","female","other","unknown"};
        for (String k : genderKeys) genders.put(k, 0);
        java.time.LocalDate today = java.time.LocalDate.now();
        
        for (Long uid : uniqueSenderIds) {
            com.wildcastradio.User.UserEntity u = senderById.get(uid);
            String ageKey;
            if (u == null || u.getBirthdate() == null) {
                ageKey = "unknown";
            } else {
                int age = java.time.Period.between(u.getBirthdate(), today).getYears();
                if (age >= 13 && age <= 19) ageKey = "teens";
                else if (age >= 20 && age <= 29) ageKey = "youngAdults";
                else if (age >= 30 && age <= 49) ageKey = "adults";
                else if (age >= 50 && age <= 64) ageKey = "middleAged";
                else if (age >= 65) ageKey = "seniors";
                else ageKey = "unknown";
            }
            ageGroups.put(ageKey, ageGroups.get(ageKey) + 1);
            String gKey;
            if (u == null || u.getGender() == null) gKey = "unknown";
            else if (u.getGender() == com.wildcastradio.User.UserEntity.Gender.MALE) gKey = "male";
            else if (u.getGender() == com.wildcastradio.User.UserEntity.Gender.FEMALE) gKey = "female";
            else if (u.getGender() == com.wildcastradio.User.UserEntity.Gender.OTHER) gKey = "other";
            else gKey = "unknown";
            genders.put(gKey, genders.get(gKey) + 1);
        }

        aRow++;
        Row dHdr = analyticsSheet.createRow(aRow++);
        dHdr.createCell(0).setCellValue("Demographics (Unique Chat Participants)");
        Row ageHdr = analyticsSheet.createRow(aRow++);
        ageHdr.createCell(0).setCellValue("Age Group");
        ageHdr.createCell(1).setCellValue("Count");
        for (String k : ageKeys) {
            Row r = analyticsSheet.createRow(aRow++);
            r.createCell(0).setCellValue(k);
            r.createCell(1).setCellValue(ageGroups.get(k));
        }
        aRow++;
        Row gHdr = analyticsSheet.createRow(aRow++);
        gHdr.createCell(0).setCellValue("Gender");
        gHdr.createCell(1).setCellValue("Count");
        for (String k : genderKeys) {
            Row r = analyticsSheet.createRow(aRow++);
            r.createCell(0).setCellValue(k);
            r.createCell(1).setCellValue(genders.get(k));
        }

        aRow++;
        Row tHdr = analyticsSheet.createRow(aRow++);
        tHdr.createCell(0).setCellValue("Top Senders");
        Row tCols = analyticsSheet.createRow(aRow++);
        tCols.createCell(0).setCellValue("Name");
        tCols.createCell(1).setCellValue("Email");
        tCols.createCell(2).setCellValue("Messages");
        java.util.List<java.util.Map.Entry<String,Integer>> top = senderCounts.entrySet().stream()
                .sorted((a,b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(5)
                .collect(java.util.stream.Collectors.toList());
        for (java.util.Map.Entry<String,Integer> e : top) {
            Row tr = analyticsSheet.createRow(aRow++);
            tr.createCell(0).setCellValue(senderNameByEmail.getOrDefault(e.getKey(), ""));
            tr.createCell(1).setCellValue(e.getKey());
            tr.createCell(2).setCellValue(e.getValue());
        }
        
        if (analyticsSheet instanceof SXSSFSheet) {
            ((SXSSFSheet) analyticsSheet).trackAllColumnsForAutoSizing();
        }
        for (int c = 0; c < 4; c++) analyticsSheet.autoSizeColumn(c);
    }

    @Transactional
    public void deleteMessageById(Long messageId) {
        if (messageId == null) {
            throw new IllegalArgumentException("messageId cannot be null");
        }
        boolean exists = chatMessageRepository.existsById(messageId);
        if (!exists) {
            throw new IllegalArgumentException("Chat message not found with ID: " + messageId);
        }
        chatMessageRepository.deleteById(messageId);
    }
}
