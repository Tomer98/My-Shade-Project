/**
 * Runs the Gradle wrapper to assemble the debug APK.
 *
 * This exists because `cd android && gradlew.bat …` in a package script depends
 * on the shell searching the current directory for the wrapper. Git Bash sets
 * NoDefaultCurrentDirectoryInExePath, which stops even cmd.exe from doing that,
 * so the script fails with "not recognized" despite the file being right there.
 * Naming the wrapper by absolute path sidesteps the lookup entirely, and works
 * from any shell and on any OS.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const androidDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'android');
const wrapper = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

// A .bat cannot be spawned directly on Windows, so cmd runs it. Naming cmd
// explicitly rather than passing shell:true keeps the arguments as arguments,
// which is both safer and free of Node's shell-with-args deprecation warning.
const [command, args] = process.platform === 'win32'
    ? ['cmd.exe', ['/d', '/s', '/c', wrapper, 'assembleDebug']]
    : [wrapper, ['assembleDebug']];

try {
    execFileSync(command, args, { cwd: androidDir, stdio: 'inherit' });
    console.log('\n✅ APK: client/android/app/build/outputs/apk/debug/app-debug.apk');
} catch {
    // Gradle has already printed why; adding a stack trace on top only buries it.
    process.exit(1);
}
