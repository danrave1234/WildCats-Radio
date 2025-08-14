package com.wildcastradio.User.DTO;

public class BanRequest {
    public enum DurationUnit { DAYS, WEEKS, YEARS, PERMANENT }

    private Integer amount; // required unless PERMANENT
    private DurationUnit unit; // DAYS, WEEKS, YEARS, PERMANENT
    private String reason; // optional but recommended

    public Integer getAmount() { return amount; }
    public void setAmount(Integer amount) { this.amount = amount; }

    public DurationUnit getUnit() { return unit; }
    public void setUnit(DurationUnit unit) { this.unit = unit; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
