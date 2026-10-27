// src/deploy/guides.ts
// بيانات قسم "النشر والبناء": الروابط والحدود والأوامر في مكان واحد.
// لو منصة غيّرت حدودها أو رابطها، عدّل هنا بس (والنصوص في src/i18n/deploy.ts).
// آخر مراجعة للأرقام من المصادر الرسمية:
export const DEPLOY_CHECKED_ON = '2026-10-25';

export type DeployGroup = 'site' | 'app';
export type DeployRole = 'primary' | 'backup' | 'experimental';

export interface DeployLink {
  labelKey: string;
  url: string;
}

// أمر أو ملف بيتنسخ زي ما هو (مش بيتترجم)
export interface DeploySnippet {
  id: string;
  labelKey: string;
  text: string;
}

export interface DeployGuide {
  id: string;
  group: DeployGroup;
  role: DeployRole;
  titleKey: string;
  summaryKey: string;
  stepKeys: string[];
  noteKeys: string[];
  limitKeys: string[];
  snippets: DeploySnippet[];
  links: DeployLink[];
}

const WEB_BUILD_CMD = 'npx expo export --platform web';

const ANDROID_APK_WORKFLOW = `name: Android APK
on: workflow_dispatch
env:
  CI: '1'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - name: Ensure android.package
        run: |
          node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('app.json','utf8'));j.expo=j.expo||{};j.expo.android=j.expo.android||{};if(!j.expo.android.package){j.expo.android.package='com.pocketforge.p'+(j.expo.slug||'app').replace(/[^a-z0-9]/gi,'').toLowerCase();}fs.writeFileSync('app.json',JSON.stringify(j,null,2));"
      - run: npm install --legacy-peer-deps
      - run: npx expo prebuild --platform android --no-install
      - run: ./gradlew assembleRelease --no-daemon
        working-directory: android
      - uses: actions/upload-artifact@v4
        with:
          name: app-release
          path: android/app/build/outputs/apk/release/*.apk
`;

export const DEPLOY_GUIDES: DeployGuide[] = [
  {
    id: 'cloudflare',
    group: 'site',
    role: 'primary',
    titleKey: 'dpl_cf_title',
    summaryKey: 'dpl_cf_summary',
    stepKeys: ['dpl_cf_s1', 'dpl_cf_s2', 'dpl_cf_s3', 'dpl_cf_s4', 'dpl_cf_s5'],
    noteKeys: [],
    limitKeys: ['dpl_cf_l1', 'dpl_cf_l2', 'dpl_cf_l3'],
    snippets: [
      { id: 'cf-build', labelKey: 'dpl_snip_build_cmd', text: WEB_BUILD_CMD },
      { id: 'cf-out', labelKey: 'dpl_snip_output_dir', text: 'dist' },
    ],
    links: [
      { labelKey: 'dpl_link_cf_dash', url: 'https://dash.cloudflare.com' },
      { labelKey: 'dpl_link_cf_guide', url: 'https://developers.cloudflare.com/pages/get-started/git-integration/' },
      { labelKey: 'dpl_link_limits', url: 'https://developers.cloudflare.com/pages/platform/limits/' },
    ],
  },
  {
    id: 'ghpages',
    group: 'site',
    role: 'backup',
    titleKey: 'dpl_gp_title',
    summaryKey: 'dpl_gp_summary',
    stepKeys: ['dpl_gp_s1', 'dpl_gp_s2', 'dpl_gp_s3', 'dpl_gp_s4'],
    noteKeys: [],
    limitKeys: ['dpl_gp_l1', 'dpl_gp_l2', 'dpl_gp_l3'],
    snippets: [{ id: 'gp-build', labelKey: 'dpl_snip_build_cmd', text: WEB_BUILD_CMD }],
    links: [
      {
        labelKey: 'dpl_link_gp_guide',
        url: 'https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site',
      },
      {
        labelKey: 'dpl_link_limits',
        url: 'https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits',
      },
    ],
  },
  {
    id: 'gha',
    group: 'app',
    role: 'experimental',
    titleKey: 'dpl_gha_title',
    summaryKey: 'dpl_gha_summary',
    stepKeys: ['dpl_gha_s1', 'dpl_gha_s2', 'dpl_gha_s3', 'dpl_gha_s4'],
    noteKeys: ['dpl_gha_n1', 'dpl_gha_n2'],
    limitKeys: ['dpl_gha_l1', 'dpl_gha_l2', 'dpl_gha_l3'],
    snippets: [{ id: 'gha-workflow', labelKey: 'dpl_snip_workflow', text: ANDROID_APK_WORKFLOW }],
    links: [
      { labelKey: 'dpl_link_local_release', url: 'https://docs.expo.dev/guides/local-app-production/' },
      { labelKey: 'dpl_link_actions_billing', url: 'https://docs.github.com/en/billing/concepts/product-billing/github-actions' },
    ],
  },
  {
    id: 'eas',
    group: 'app',
    role: 'backup',
    titleKey: 'dpl_eas_title',
    summaryKey: 'dpl_eas_summary',
    stepKeys: ['dpl_eas_s1', 'dpl_eas_s2', 'dpl_eas_s3', 'dpl_eas_s4', 'dpl_eas_s5'],
    noteKeys: ['dpl_eas_n1'],
    limitKeys: ['dpl_eas_l1', 'dpl_eas_l2', 'dpl_eas_l3', 'dpl_eas_l4'],
    snippets: [
      { id: 'eas-login', labelKey: 'dpl_snip_eas_login', text: 'npx eas-cli login' },
      { id: 'eas-config', labelKey: 'dpl_snip_eas_config', text: 'npx eas-cli build:configure' },
      { id: 'eas-first', labelKey: 'dpl_snip_eas_first', text: 'npx eas-cli build -p android' },
    ],
    links: [
      { labelKey: 'dpl_link_expo', url: 'https://expo.dev' },
      { labelKey: 'dpl_link_eas_github', url: 'https://docs.expo.dev/build/building-from-github/' },
      { labelKey: 'dpl_link_eas_pricing', url: 'https://expo.dev/pricing' },
    ],
  },
];