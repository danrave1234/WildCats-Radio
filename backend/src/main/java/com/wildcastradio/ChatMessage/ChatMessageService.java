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

    /**
     * Get all messages for a specific broadcast
     * 
     * @param broadcastId The ID of the broadcast
     * @return List of chat message DTOs
     */
    public List<ChatMessageDTO> getMessagesForBroadcast(Long broadcastId) {
        List<ChatMessageEntity> messages = chatMessageRepository.findByBroadcast_IdOrderByCreatedAtAsc(broadcastId);
        return messages.stream()
                .map(ChatMessageDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Create a new chat message
     * 
     * @param broadcastId The ID of the broadcast
     * @param sender The user sending the message
     * @param content The content of the message
     * @return The created chat message entity
     * @throws IllegalArgumentException if the broadcast with the given ID doesn't exist
     */
	public ChatMessageEntity createMessage(Long broadcastId, UserEntity sender, String content) {
        // Validate content length
        if (content == null || content.length() > 1500) {
            throw new IllegalArgumentException("Message content must not be null and must not exceed 1500 characters");
        }

        // Fetch the broadcast entity
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
            .orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));

		// Sanitize content for profanity before saving/broadcasting (local + optional external API)
		String sanitized = profanityService.sanitizeContent(content);

		// Create the message with the broadcast entity
		ChatMessageEntity message = new ChatMessageEntity(broadcast, sender, sanitized);
		// Persist original content for accurate exports
		message.setOriginalContent(content);
        ChatMessageEntity savedMessage = chatMessageRepository.save(message);

        // Create DTO for the message
        ChatMessageDTO messageDTO = ChatMessageDTO.fromEntity(savedMessage);

        // Notify all clients about the new chat message
        System.out.println("Broadcasting chat message to /topic/broadcast/" + broadcastId + "/chat");
        System.out.println("Message content: " + messageDTO.getContent());
        System.out.println("Sender: " + (messageDTO.getSender() != null ? messageDTO.getSender().getEmail() : "null"));
        
        messagingTemplate.convertAndSend(
                "/topic/broadcast/" + broadcastId + "/chat",
                messageDTO
        );

        return savedMessage;
    }

    // Analytics methods for data retrieval
    public long getTotalMessageCount() {
        return chatMessageRepository.count();
    }

    public double getAverageMessagesPerBroadcast() {
        long totalMessages = getTotalMessageCount();
        long totalBroadcasts = broadcastRepository.count();

        if (totalBroadcasts == 0) {
            return 0.0;
        }

        return (double) totalMessages / totalBroadcasts;
    }

    // Expose repository for analytics breakdown queries (kept simple for now)
    public ChatMessageRepository getRepository() {
        return chatMessageRepository;
    }

    /**
     * Clean up messages older than 7 days
     * This method is called by a scheduled task to maintain database cleanliness
     * 
     * @return Number of messages deleted
     */
    @Transactional
    public int cleanupOldMessages() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(7);

        // Count messages to be deleted for logging
        long messagesToDelete = chatMessageRepository.countByCreatedAtBefore(cutoffDate);

        if (messagesToDelete > 0) {
            logger.info("Starting cleanup of {} messages older than {}", messagesToDelete, cutoffDate);

            // Delete old messages
            int deletedCount = chatMessageRepository.deleteByCreatedAtBefore(cutoffDate);

            logger.info("Successfully deleted {} old chat messages", deletedCount);
            return deletedCount;
        } else {
            logger.debug("No old messages found for cleanup");
            return 0;
        }
    }

    /**
     * Get messages for a specific broadcast that can be exported
     * 
     * @param broadcastId The ID of the broadcast
     * @return List of chat message entities for export
     */
    public List<ChatMessageEntity> getMessagesForExport(Long broadcastId) {
        return chatMessageRepository.findByBroadcast_IdOrderByCreatedAtAsc(broadcastId);
    }

    /**
     * Get count of messages that would be deleted in cleanup
     * 
     * @return Number of messages older than 7 days
     */
    public long getOldMessagesCount() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(7);
        return chatMessageRepository.countByCreatedAtBefore(cutoffDate);
    }

    /**
     * Export messages for a specific broadcast to Excel format
     * 
     * @param broadcastId The ID of the broadcast
     * @return Byte array containing the Excel file data
     * @throws IOException if there's an error creating the Excel file
     */
    public byte[] exportMessagesToExcel(Long broadcastId) throws IOException {
        // Validate broadcast exists
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
            .orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));

        // Get messages for the broadcast
        List<ChatMessageEntity> messages = chatMessageRepository.findByBroadcast_IdOrderByCreatedAtAsc(broadcastId);

        // Create workbook and sheet (use SXSSF for lower memory on large exports)
        SXSSFWorkbook workbook = new SXSSFWorkbook(100);
        SXSSFSheet sheet = workbook.createSheet("Chat Messages");

        // Create header style
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerStyle.setFont(headerFont);

        // Create censored highlight style (light yellow fill) for message content cell
        CellStyle censoredStyle = workbook.createCellStyle();
        censoredStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
        censoredStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        // Create header row
        Row headerRow = sheet.createRow(0);
        String[] headers = {"Sender Name", "Sender Email", "Message Content", "Timestamp"};

        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        // Date formatter for timestamps
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        // Add data rows
        int rowNum = 1;
        for (ChatMessageEntity message : messages) {
            Row row = sheet.createRow(rowNum++);

            row.createCell(0).setCellValue(message.getSender().getDisplayNameOrFullName());
            row.createCell(1).setCellValue(message.getSender().getEmail());

            // Determine if message was censored by comparing to replacement phrase
            String replacement = ProfanityFilter.getReplacementPhrase();
            boolean isCensored = message.getContent() != null && message.getContent().equals(replacement);

            // Prefer original content if available and differs from stored content
            String original = message.getOriginalContent();
            String valueToWrite;
            if (isCensored && original != null && !original.isBlank()) {
                valueToWrite = original;
            } else {
                valueToWrite = message.getContent();
            }

            Cell messageCell = row.createCell(2);
            messageCell.setCellValue(valueToWrite);
            if (isCensored) {
                messageCell.setCellStyle(censoredStyle);
            }

            row.createCell(3).setCellValue(message.getCreatedAt().format(formatter));
        }

        // Auto-size columns (track for SXSSF)
        sheet.trackAllColumnsForAutoSizing();
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }

        // Add broadcast information sheet
        Sheet infoSheet = workbook.createSheet("Broadcast Info");
        Row infoRow1 = infoSheet.createRow(0);
        infoRow1.createCell(0).setCellValue("Broadcast Title:");
        infoRow1.createCell(1).setCellValue(broadcast.getTitle());

        Row infoRow2 = infoSheet.createRow(1);
        infoRow2.createCell(0).setCellValue("Description:");
        infoRow2.createCell(1).setCellValue(broadcast.getDescription() != null ? broadcast.getDescription() : "N/A");

        Row infoRow3 = infoSheet.createRow(2);
        infoRow3.createCell(0).setCellValue("Created By:");
        infoRow3.createCell(1).setCellValue(broadcast.getCreatedBy().getDisplayNameOrFullName());

        Row infoRow4 = infoSheet.createRow(3);
        infoRow4.createCell(0).setCellValue("Total Messages:");
        infoRow4.createCell(1).setCellValue(messages.size());

        Row infoRow5 = infoSheet.createRow(4);
        infoRow5.createCell(0).setCellValue("Start Time:");
        infoRow5.createCell(1).setCellValue(broadcast.getActualStart() != null ? broadcast.getActualStart().format(formatter) : "N/A");

        Row infoRow6 = infoSheet.createRow(5);
        infoRow6.createCell(0).setCellValue("End Time:");
        infoRow6.createCell(1).setCellValue(broadcast.getActualEnd() != null ? broadcast.getActualEnd().format(formatter) : "N/A");

        Row infoRow7 = infoSheet.createRow(6);
        infoRow7.createCell(0).setCellValue("Duration:");
        String durationStr;
        if (broadcast.getActualStart() != null && broadcast.getActualEnd() != null) {
            java.time.Duration d = java.time.Duration.between(broadcast.getActualStart(), broadcast.getActualEnd());
            long hours = d.toHours();
            long minutes = d.minusHours(hours).toMinutes();
            durationStr = String.format("%02dh %02dm", hours, minutes);
        } else {
            durationStr = "N/A";
        }
        infoRow7.createCell(1).setCellValue(durationStr);

        Row infoRow8 = infoSheet.createRow(7);
        infoRow8.createCell(0).setCellValue("Exported At:");
        infoRow8.createCell(1).setCellValue(LocalDateTime.now().format(formatter));

        Row legendRow = infoSheet.createRow(9);
        legendRow.createCell(0).setCellValue("Legend:");
        legendRow.createCell(1).setCellValue("Yellow cell in Message Content = message was censored");

        // Auto-size columns in info sheet (track for SXSSF)
        if (infoSheet instanceof SXSSFSheet) {
            ((SXSSFSheet) infoSheet).trackAllColumnsForAutoSizing();
        }
        infoSheet.autoSizeColumn(0);
        infoSheet.autoSizeColumn(1);

        // Write to byte array
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        try {
            workbook.write(outputStream);
            logger.info("Successfully exported {} messages for broadcast {} to Excel", messages.size(), broadcastId);
            return outputStream.toByteArray();
        } finally {
            workbook.dispose();
            workbook.close();
            outputStream.close();
        }
    }

	/**
	 * Stream messages for a specific broadcast directly to an OutputStream in Excel format.
	 * Uses SXSSFWorkbook for low memory footprint and pages DB reads.
	 */
	public void streamMessagesToExcel(Long broadcastId, OutputStream outputStream) throws IOException {
		BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
			.orElseThrow(() -> new IllegalArgumentException("Broadcast not found with ID: " + broadcastId));

		SXSSFWorkbook workbook = new SXSSFWorkbook(100);
		SXSSFSheet sheet = workbook.createSheet("Chat Messages");

		CellStyle headerStyle = workbook.createCellStyle();
		Font headerFont = workbook.createFont();
		headerFont.setBold(true);
		headerStyle.setFont(headerFont);

		CellStyle censoredStyle = workbook.createCellStyle();
		censoredStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
		censoredStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

		// Header
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
			}
			page++;
		} while (!pageResult.isLast());

		// Auto-size columns with tracking for SXSSF
		sheet.trackAllColumnsForAutoSizing();
		for (int i = 0; i < headers.length; i++) {
			sheet.autoSizeColumn(i);
		}

		// Info sheet
		Sheet infoSheet = workbook.createSheet("Broadcast Info");
		Row infoRow1 = infoSheet.createRow(0);
		infoRow1.createCell(0).setCellValue("Broadcast Title:");
		infoRow1.createCell(1).setCellValue(broadcast.getTitle());
		Row infoRow2 = infoSheet.createRow(1);
		infoRow2.createCell(0).setCellValue("Description:");
		infoRow2.createCell(1).setCellValue(broadcast.getDescription() != null ? broadcast.getDescription() : "N/A");
		Row infoRow3 = infoSheet.createRow(2);
		infoRow3.createCell(0).setCellValue("Created By:");
		infoRow3.createCell(1).setCellValue(broadcast.getCreatedBy().getDisplayNameOrFullName());
		Row infoRow4b = infoSheet.createRow(3);
		infoRow4b.createCell(0).setCellValue("Total Messages:");
		long totalMessages = chatMessageRepository.countByCreatedAtBetween(
				broadcast.getActualStart() != null ? broadcast.getActualStart() : LocalDateTime.now().minusYears(50),
				broadcast.getActualEnd() != null ? broadcast.getActualEnd() : LocalDateTime.now().plusYears(50)
		);
		infoRow4b.createCell(1).setCellValue(totalMessages);
		Row infoRow5b = infoSheet.createRow(4);
		infoRow5b.createCell(0).setCellValue("Start Time:");
		infoRow5b.createCell(1).setCellValue(broadcast.getActualStart() != null ? broadcast.getActualStart().format(formatter) : "N/A");
		Row infoRow6b = infoSheet.createRow(5);
		infoRow6b.createCell(0).setCellValue("End Time:");
		infoRow6b.createCell(1).setCellValue(broadcast.getActualEnd() != null ? broadcast.getActualEnd().format(formatter) : "N/A");
		Row infoRow7b = infoSheet.createRow(6);
		infoRow7b.createCell(0).setCellValue("Duration:");
		String durationStr2;
		if (broadcast.getActualStart() != null && broadcast.getActualEnd() != null) {
			java.time.Duration d = java.time.Duration.between(broadcast.getActualStart(), broadcast.getActualEnd());
			long hours = d.toHours();
			long minutes = d.minusHours(hours).toMinutes();
			durationStr2 = String.format("%02dh %02dm", hours, minutes);
		} else {
			durationStr2 = "N/A";
		}
		infoRow7b.createCell(1).setCellValue(durationStr2);
		Row infoRow8b = infoSheet.createRow(7);
		infoRow8b.createCell(0).setCellValue("Exported At:");
		infoRow8b.createCell(1).setCellValue(LocalDateTime.now().format(formatter));
		Row legendRow2 = infoSheet.createRow(9);
		legendRow2.createCell(0).setCellValue("Legend:");
		legendRow2.createCell(1).setCellValue("Yellow cell in Message Content = message was censored");

		// Track columns for autosizing on SXSSF info sheet
		if (infoSheet instanceof SXSSFSheet) {
			((SXSSFSheet) infoSheet).trackAllColumnsForAutoSizing();
		}
		infoSheet.autoSizeColumn(0);
		infoSheet.autoSizeColumn(1);

		try {
			workbook.write(outputStream);
			logger.info("Successfully exported chat for broadcast {}", broadcastId);
		} finally {
			workbook.dispose();
			workbook.close();
		}
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
