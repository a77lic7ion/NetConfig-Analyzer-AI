<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# NetConfig Analyzer

NetConfig Analyzer is a powerful, AI-driven tool designed for automated analysis, parsing, and conflict detection in network device configurations. It supports multiple vendors, including Cisco, Huawei, Juniper, and H3C, providing network engineers with a unified platform to audit and optimize their network environments.

## 🚀 Features

- **Multi-Vendor Support**: Unified parsing and analysis for Cisco (IOS, NX-OS), Huawei (VRP), Juniper (Junos), and H3C (Comware).
- **Intelligent Parsing**: Automatically extracts structured data such as:
    - Device Information (Hostname, OS, Model)
    - Interface Configurations & IP addressing
    - VLANs & SVIs
    - Routing Protocols (OSPF, BGP, Static Routes)
    - Security Features (AAA, ACLs, SSH)
- **AI-Powered Audit**: Leverage LLMs to detect security risks, misconfigurations, and best practice violations.
- **CLI Command Helper**: Describe a task in natural language and get the exact CLI commands for your specific vendor.
- **Automated CLI Script Writer**: Generate comprehensive configuration scripts from natural language descriptions.
- **Interactive Chat Agent**: Ask questions directly about your configuration analysis and get instant AI-driven insights.
- **Detailed Reporting**: Visualizes data with interactive charts and provides clear, actionable findings.
- **HTML Export**: Save your full analysis reports as self-contained HTML files for easy sharing and offline viewing.
- **Local Database**: Securely store your analysis findings in a local IndexedDB for persistence.

## 🛠️ Installation

### Web Application

**Prerequisites:** Node.js (v18 or higher recommended)

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/a77lic7ion/netconfig-analyzer.git
   cd netconfig-analyzer
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure LLM Settings:**
   Open the application in your browser, click the **Settings** icon (gear), and configure your preferred LLM provider (e.g., Gemini API Key, OpenAI API Key, or local Ollama URL).

4. **Run Locally:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

5. **Build for Production:**
   ```bash
   npm run build
   ```

### Android APK Installation

You can build and install the Android application using Capacitor.

**Prerequisites:** Android Studio, Java Development Kit (JDK).

1. **Build the Web Project:**
   ```bash
   npm run build
   ```

2. **Sync with Android Project:**
   ```bash
   npx cap sync android
   ```

3. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

4. **Build the APK:**
   - In Android Studio, wait for Gradle sync to finish.
   - Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - Once the build is complete, a notification will appear with a "locate" link to the APK file.

5. **Install on Device:**
   - Transfer the generated `.apk` file to your Android device.
   - On your device, enable "Install from Unknown Sources" in settings.
   - Open the `.apk` file and follow the prompts to install.

## ⚙️ Supported Vendors

| Vendor | OS Support | Extensions |
| :--- | :--- | :--- |
| **Cisco** | IOS, NX-OS | .txt, .cfg, .log |
| **Huawei** | VRP | .txt, .cfg, .dat |
| **Juniper** | Junos | .txt, .cfg, .conf |
| **H3C** | Comware | .cfg, .txt |

## 🤖 Supported LLM Providers

NetConfig Analyzer supports a wide range of LLM providers:

- **Google Gemini** (Default)
- **OpenAI (GPT-4, etc.)**
- **Anthropic (Claude)**
- **DeepSeek**
- **Ollama** (Local)
- **xAI (Grok)**
- **Cloudflare Workers AI**
- **Mistral**
- **Hugging Face**
- **OpenRouter**

---
&copy; 2025 NetConfig Analyzer.
