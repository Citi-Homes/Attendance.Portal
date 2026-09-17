package ae.citihomes.attendance;

import org.junit.Test;
import java.util.Calendar;
import java.util.TimeZone;
import static org.junit.Assert.*;

public class ReminderTimeTest {
    @Test public void skipsSundayAndUsesPhoneTimezone() {
        TimeZone previous = TimeZone.getDefault();
        try {
            for (String zone : new String[]{"Asia/Dubai", "Europe/London"}) {
                TimeZone.setDefault(TimeZone.getTimeZone(zone));
                Calendar now = Calendar.getInstance();
                now.set(2026, Calendar.SEPTEMBER, 19, 18, 0, 0);
                Calendar next = Calendar.getInstance();
                next.setTimeInMillis(AttendanceReminder.nextTime(9, now.getTimeInMillis()));
                assertEquals(Calendar.MONDAY, next.get(Calendar.DAY_OF_WEEK));
                assertEquals(9, next.get(Calendar.HOUR_OF_DAY));
                assertEquals(55, next.get(Calendar.MINUTE));
                assertEquals(0, next.get(Calendar.SECOND));
            }
        } finally { TimeZone.setDefault(previous); }
    }
    @Test public void choosesTodayBeforeAndTomorrowAfterReminder() {
        Calendar now = Calendar.getInstance();
        now.set(2026, Calendar.SEPTEMBER, 17, 17, 54, 0);
        long next = AttendanceReminder.nextTime(17, now.getTimeInMillis());
        assertTrue(next > now.getTimeInMillis());
        assertTrue(next - now.getTimeInMillis() <= 60000);
        assertTrue(AttendanceReminder.nextTime(17, next) - next >= 23 * 60 * 60 * 1000L);
    }
}
