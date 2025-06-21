# Deploying the Backend to Google Cloud Run: A Step-by-Step Guide

This guide will walk you through the entire process of deploying the WildCats Radio backend to Google Cloud Run. We will cover setting up your Google Cloud project, building the application container, and deploying it.

---

### **Step 1: Set Up Your Google Cloud Environment**

Before you can deploy the application, you need to configure your Google Cloud project.

**1.1. Select or Create a Project**

*   Go to the [Google Cloud Console](https://console.cloud.google.com).
*   In the top bar, click the project selection dropdown.
    ![Project Selector](https://storage.googleapis.com/gweb-cloudblog-publish/images/Project-Selector.max-1500x1500.png)
*   Select the project you want to use. If you don't have one, click **NEW PROJECT**, give it a name (e.g., `wildcats-radio`), and click **CREATE**.

**1.2. Enable Billing**

*   Deployment requires a project linked to a billing account.
*   In the navigation menu (☰), go to **Billing**.
*   Confirm your project is linked to an active billing account. If not, you will be prompted to create one or link an existing one.

**1.3. Enable Required APIs**

*   For deployment, we need the Cloud Build, Artifact Registry, and Cloud Run APIs.
*   Open the [Cloud Shell](https://shell.cloud.google.com/?show=terminal) by clicking the `>_` icon in the top right of the console.
*   A terminal will open at the bottom of your screen. Copy and paste the following command and press Enter. This is a one-time setup for your project.

    ```bash
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
    ```

**1.4. Configure the Google Cloud CLI (`gcloud`)**

*   If you haven't already, install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) on your local machine.
*   Open your local terminal (like PowerShell or Command Prompt) and run the following command to log in and select the project you just set up:

    ```bash
    gcloud init
    ```
*   Follow the on-screen prompts to log into your Google account and choose the project you just configured.

---

### **Step 2: Build Your Application's Container Image**

This step packages your Java application into a Docker container image and uploads it to Google's Artifact Registry so Cloud Run can use it.

*   Open your local terminal or PowerShell.
*   Navigate to the root directory of the `WildCats-Radio` project.
*   Run the command below. **Make sure to replace `[PROJECT_ID]` with your actual Google Cloud Project ID** (the one you see in the console).

    ```bash
    # Replace [PROJECT_ID] with your actual Google Cloud Project ID
    gcloud builds submit --tag gcr.io/[PROJECT_ID]/wildcats-radio-backend ./backend
    ```
*   This command uses Cloud Build to execute the build. You will see logs in your terminal. The process can take a few minutes. On completion, you will see a `SUCCESS` message.

---

### **Step 3: Deploy the Container to Cloud Run**

Now we'll create the Cloud Run service that runs your container.

*   Go back to the [Google Cloud Console](https://console.cloud.google.com).
*   In the navigation menu (☰), find and select **Cloud Run**.
*   Click **CREATE SERVICE**.
*   Under *Deploy one revision from an existing container image*, select your image:
    *   Click **SELECT**.
    *   In the right-side panel, choose the **Artifact Registry** tab.
    *   In the repository list, find and click on **gcr.io/[PROJECT_ID]/wildcats-radio-backend**.
    *   Click on the image that appears in the next panel. It should be tagged as `latest`.
    *   Click **DONE**.
*   Give your service a **Service name**, for example, `wildcats-radio-backend`.
*   Choose a **Region** that is close to your users (e.g., `us-central1`).
*   Under **Authentication**, select **Allow unauthenticated invocations**. This makes your API publicly accessible so the frontend can communicate with it.
*   Now, expand the **Container(s), volumes, networking, security** section. This is where you will configure the necessary environment variables.
*   Go to the **Variables & Secrets** tab.

---

### **Step 4: Configure Environment Variables**

Your application will not start without its configuration, which is provided by environment variables.

*   On the **Variables & Secrets** tab, click **ADD VARIABLE** for each of the following items. You need to get these values from your `application.properties` file or your development setup.

    *   `JDBC_DATABASE_URL`
    *   `JDBC_DATABASE_USERNAME`
    *   `JDBC_DATABASE_PASSWORD`
    *   `JWT_SECRET`
    *   `MAIL_USERNAME`
    *   `MAIL_PASSWORD`
    *   `APP_DOMAIN` (This will be the URL of your deployed frontend)
    *   `ICECAST_HOST`
    *   ...and any other variables your application needs.

*   **For sensitive data** like passwords and secret keys, it is highly recommended to use **Secret Manager**:
    1.  In a new tab, open **Secret Manager** in the Google Cloud Console.
    2.  Click **CREATE SECRET**. Give it a name (e.g., `jwt-secret`) and enter the secret value. Click **CREATE SECRET**.
    3.  Grant your Cloud Run service account access to it.
    4.  Back in the Cloud Run service creation page, instead of "ADD VARIABLE", click **REFERENCE SECRET**. You can then select the secret you created. This is the most secure way to handle credentials.

*   After adding all your variables, click **CREATE**.

---

### **Step 5: Verify Your Deployment**

*   After a few moments, your service will be deployed. You will see a green checkmark on the service details page.
*   At the top of the page, you will find the **URL** for your new service. This is the base URL for your backend API.
*   You can check for any startup errors by clicking the **LOGS** tab.

You have now successfully deployed your backend to Google Cloud Run!

---

### **Step 6: Set Up Continuous Deployment (Optional, but Recommended)**

Continuous deployment automatically rebuilds and redeploys your service whenever you push changes to your source code repository. This saves you from having to manually run `gcloud builds submit` and `gcloud run deploy` for every change.

**6.1. Go to Your Cloud Run Service**

*   In the [Google Cloud Console](https://console.cloud.google.com), navigate to your `wildcats-radio-backend` service.
*   Click **EDIT AND DEPLOY NEW REVISION**.

**6.2. Set Up Continuous Deployment from a Repository**

*   Click the button that says **Continuously deploy new revisions from a source repository**.
*   Click **SET UP WITH CLOUD BUILD**.

**6.3. Configure the Source Repository**

*   A new panel will open. You will be prompted to select a source repository.
*   **Provider**: Choose your repository provider (e.g., GitHub).
*   **Repository**: Select your `WildCats-Radio` repository. You may need to authenticate with your provider if you haven't already.
*   After selecting the repository, a consent screen might appear. Check the box and click **CONNECT**.
*   Click **DONE**.

**6.4. Configure the Build**

*   You will now be back on the "Edit and deploy new revision" page with new "Build Configuration" options, just like in the image you sent.
*   **Branch**: Enter `^main$` to automatically build from your `main` branch.
*   **Build Type**: Select **Dockerfile**.
*   **Source location**: This is the most important step for your project structure. Enter `/backend/Dockerfile`.
    *   This tells Cloud Build that the `Dockerfile` is inside your `backend` folder. The build will run from within that `backend` directory.

    Your configuration should match the following:
    *   **Branch**: `^main$`
    *   **Build Type**: `Dockerfile`
    *   **Source location**: `/backend/Dockerfile`

*   Click **SAVE**.

**6.5. Final Deployment**

*   The rest of the service configuration (environment variables, etc.) should still be there from your previous deployment.
*   Scroll down and click **DEPLOY**.

Cloud Build will now create a "trigger" that watches your repository. The next time you push a change to the `main` branch, it will automatically build a new container from your `backend` directory and deploy a new revision to your Cloud Run service.
