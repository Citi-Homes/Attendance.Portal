package ae.citihomes.attendance;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle state) {
        super.onCreate(state);
        AttendanceReminder.schedule(this);
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 955);
        } else {
            offerExactReminders();
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        if (code == 955) offerExactReminders();
    }

    private void offerExactReminders() {
        if (android.os.Build.VERSION.SDK_INT < 31) return;
        android.app.AlarmManager alarms = getSystemService(android.app.AlarmManager.class);
        android.content.SharedPreferences prefs = getSharedPreferences("reminders", MODE_PRIVATE);
        if (alarms.canScheduleExactAlarms() || prefs.getBoolean("exactPromptShown", false)) return;
        prefs.edit().putBoolean("exactPromptShown", true).apply();
        new android.app.AlertDialog.Builder(this)
            .setTitle("On-time attendance reminders")
            .setMessage("Allow Alarms & reminders so your phone can remind you at 09:55 and 17:55, even when the app is closed.")
            .setPositiveButton("Open settings", (dialog, which) -> {
                try {
                    startActivity(new android.content.Intent(
                        android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        android.net.Uri.parse("package:" + getPackageName())));
                } catch (android.content.ActivityNotFoundException ignored) {}
            }).setNegativeButton("Later", null).show();
    }

    @Override public void onResume() {
        super.onResume();
        AttendanceReminder.schedule(this);
    }
}
