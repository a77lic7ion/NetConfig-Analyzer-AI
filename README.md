# NetConfig Analyzer

NetConfig Analyzer is a powerful web-based tool designed to help network engineers and administrators analyze and manage network device configurations. It provides a user-friendly interface to upload configuration files, parse them to extract key information, and analyze them for security vulnerabilities and best-practice violations. The tool also includes AI-powered features to assist with CLI command generation and automated script writing.

## Core Features

*   **Configuration Ingestion & Parsing:** Upload configuration files from various vendors (Cisco, Juniper, etc.) and the tool will parse them to extract critical information like hostname, IOS version, VLANs, interfaces, and routing protocols.
*   **Configuration Analysis:** Run a comprehensive analysis on the parsed configuration to identify potential security risks, misconfigurations, and deviations from best practices.
*   **AI-Powered CLI Helper:** Describe a task in plain English, and the CLI Helper will suggest the appropriate CLI commands for the selected network vendor.
*   **Automated Script Writer:** Generate complete configuration scripts based on your requirements, saving you time and reducing the risk of manual errors.
*   **Data Organization:** Organize your parsed configurations and generated scripts by Company and Site, making it easy to manage data for different clients or locations.
*   **Export to PDF:** Export detailed configuration and analysis reports to PDF for documentation and sharing.
*   **Export to Zip:** Export all data associated with a Company or Site into a single zip file for backup or migration.

## Technologies Used

*   **Frontend:** React, TypeScript, Vite
*   **Styling:** Tailwind CSS
*   **Charting:** Recharts
*   **AI:** Google Gemini API
*   **Local Storage:** IndexedDB for persistent data storage in the browser.
*   **Zip Generation:** JSZip

## Application Architecture

The application is a single-page application (SPA) built with React and TypeScript. It runs entirely in the browser, with no server-side backend required for its core functionality.

*   **`components`:** Contains all the React components that make up the UI.
*   **`services`:** Contains the business logic of the application:
    *   `parserService.ts`: Orchestrates the configuration parsing process, selecting the appropriate parser (local or Gemini) based on the vendor.
    *   `ciscoParser.ts`: A detailed, hand-written parser for Cisco IOS configurations.
    *   `geminiService.ts`: Interacts with the Google Gemini API for AI-powered features like configuration analysis, CLI command generation, and script writing.
    *   `dbService.ts`: Manages the IndexedDB, providing functions for storing, retrieving, and deleting data.
*   **`types.ts`:** Contains all the TypeScript type definitions used throughout the application.
*   **`constants.ts`:** Contains all the constant values used in the application.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (version 16 or later)
*   A Google Gemini API Key

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd netconfig-analyzer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your environment variables:**
    Create a `.env.local` file in the root of the project and add your Gemini API key:
    ```
    VITE_GEMINI_API_KEY=your_gemini_api_key
    ```
    *Note: The `VITE_` prefix is required for Vite to expose the environment variable to the frontend code.*

4.  **Run the application:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

## How to Use

1.  **Select a Vendor:** Choose the network vendor of the configuration file you want to upload.
2.  **Upload Configuration:** Click "Browse..." to select a configuration file from your local machine. The application will automatically parse the file and display a summary.
3.  **Run Analysis:** Click "Run Analysis" to get a detailed report of potential issues and recommendations.
4.  **Use the CLI Helper:** Enter a description of a task in the "CLI Command Helper" section to get CLI command suggestions.
5.  **Generate Scripts:** Use the "Automated CLI Script Writer" to generate complete configuration scripts.
6.  **Organize Your Data:**
    *   Use the "Company/Site Management" section to create and manage companies and sites.
    *   Save your parsed configurations and generated scripts to the desired company/site.
7.  **Export Data:**
    *   Export reports to PDF using the "Export Full Report to PDF" button.
    *   Export all data for a company or site to a zip file using the "Export to Zip" button.
