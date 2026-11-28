// src/builds/workflow.ts
// ملف GitHub Actions اللي بيبني APK تجريبي لمشروع Expo. بيتحط في مستودع المشروع المربوط.
export const WORKFLOW_FILE = 'build-apk.yml';
export const WORKFLOW_PATH = `.github/workflows/${WORKFLOW_FILE}`;
export const RELEASE_PREFIX = 'build-';

// سكربت صغير بيضمن وجود android.package في app.json (مطلوب لـ expo prebuild في CI)
const ENSURE_PACKAGE = [
  "const fs=require('fs');",
  "const j=JSON.parse(fs.readFileSync('app.json','utf8'));",
  'j.expo=j.expo||{};j.expo.android=j.expo.android||{};',
  'if(!j.expo.android.package){',
  "const s=String(j.expo.slug||j.expo.name||'app').toLowerCase().replace(/[^a-z0-9]/g,'');",
  "j.expo.android.package='com.pocketforge.'+(/^[a-z]/.test(s)?s:'app'+s);",
  '}',
  "fs.writeFileSync('app.json',JSON.stringify(j,null,2));",
].join('');

export function buildWorkflowYaml(): string {
  return `name: Build APK

# بيتشغّل يدويًا من تاب الموصّلات في PocketForge (أو من تاب Actions على GitHub)
on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-apk:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Install dependencies
        run: npm install --legacy-peer-deps

      - name: Ensure Android package name
        run: |
          node -e "${ENSURE_PACKAGE.replace(/"/g, '\\"')}"

      - name: Generate Android project
        run: npx expo prebuild --platform android --no-install

      - name: Build APK
        run: ./gradlew assembleRelease
        working-directory: android

      - name: Publish APK as a prerelease
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          gh release create "${RELEASE_PREFIX}\${{ github.run_number }}" \\
            android/app/build/outputs/apk/release/app-release.apk \\
            --prerelease \\
            --target "\${GITHUB_SHA}" \\
            --title "APK #\${{ github.run_number }}" \\
            --notes "Test APK built from PocketForge (debug-signed, for testing only)."
`;
}
