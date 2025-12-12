# WildCats Radio

WildCats Radio is a digital campus radio platform designed for universities and student communities.

It lets student DJs run live shows on a real schedule, connect with listeners through live chat and announcements, and collect basic analytics on how shows are performing – all with a simple web and mobile experience.

This README is written for **non‑technical stakeholders** (faculty, administrators, and potential investors) and focuses on **why** the product exists, **who** it serves, and **how** it works at a high level.

---

## 1. Problem & Vision

Traditional campus radio is powerful but under‑utilized:
- Many stations rely on aging equipment and closed physical studios.
- Shows are hard to discover unless you already know when and where to tune in.
- There is little feedback on which shows students actually listen to.
- Student DJs often lack modern tools for engaging with their audience beyond a phone line or social media.

**Vision:** WildCats Radio turns campus radio into a modern, interactive, data‑informed platform that:
- Makes it easy for students to run live shows from a browser.
- Gives listeners a simple way to tune in from anywhere (web or mobile).
- Lets faculty and administrators see that the station is being used and is creating value for the campus community.

---

## 2. Who It’s For

**Students (DJs and content creators)**
- Schedule live shows in advance.
- Start and end shows confidently from a dashboard.
- Interact with listeners via live chat and announcements.
- Understand how many people are listening and when.

**Listeners (students, alumni, community)**
- Join from a web browser or mobile app – no special hardware.
- See what’s live right now and what’s coming up.
- Listen to live audio and participate through chat and reactions.

**Faculty & administrators**
- Get visibility into station usage and engagement.
- Ensure content standards through moderation tools.
- Use the platform as a showcase for student media and digital communication programs.

---

## 3. How It Works – A Simple Walkthrough

Imagine a student DJ planning a weekly show:

1. **Plan & Schedule**  
   The DJ logs into the web dashboard, creates a new broadcast, and selects a time slot (for example, Fridays at 7 PM).

2. **Go Live**  
   When it’s time, the DJ opens the dashboard and starts the show. The system connects to the streaming server in the background so that listeners can immediately tune in.

3. **Listeners Join**  
   Students open the website or mobile app, see that a show is live, and press play. They can listen from on‑campus, at home, or on the go.

4. **Real‑Time Interaction**  
   While the show is live, listeners can chat, react, and send in song requests. The DJ and moderators can highlight messages, remove inappropriate content, and keep the conversation positive.

5. **Announcements & Important Messages**  
   Station staff or moderators can publish announcements (for example, “Midterms playlist tonight!” or “Campus event at 8 PM”). These can be pinned so all listeners see them.

6. **After the Show**  
   Once the show ends, the broadcast appears in history for station staff. They can see when it ran and basic engagement metrics such as listener counts over time.

This flow is already running and has been **tested with real users**, demonstrating that students can successfully host shows and listeners can join and engage.

---

## 4. What’s Implemented Today

WildCats Radio is not a prototype on paper – it is a working system with the following major capabilities:

- **Live broadcasts with scheduling**  
  DJs can create shows ahead of time, start and end them from a dashboard, and see which broadcasts are upcoming or live now.

- **Live audio streaming**  
  Shows are streamed through a dedicated audio streaming server (Icecast). The platform is designed to keep broadcasts running smoothly even if the streaming server is temporarily slow or unreachable.

- **Real‑time listener chat**  
  Listeners can send messages during a show, and DJs/moderators see those messages instantly. Slow‑mode controls help prevent spam.

- **Moderation tools**  
  Moderators can remove inappropriate messages and temporarily or permanently block abusive users, helping maintain a safe and inclusive environment.

- **Announcements system**  
  Station staff can create announcements, review them, and publish them to listeners. Announcements can be scheduled and pinned during key moments.

- **Analytics & history**  
  The system tracks listener counts and past broadcasts, giving staff a basic picture of which shows attract attention and when.

- **Web and mobile apps**  
  There is a responsive web frontend and a mobile app experience so that listeners can join from different devices with a consistent interface.

---

## 5. Architecture at a Glance (High Level)

At a conceptual level, WildCats Radio is made up of four main pieces:

1. **Web Application**  
   A browser‑based interface for listeners, DJs, and station staff. This is where users discover shows, listen to audio, chat, and manage broadcasts.

2. **Mobile Application**  
   A mobile client that mirrors the core listening and interaction features of the web app, optimized for phones.

3. **Backend Service**  
   A central application that handles user accounts, broadcast scheduling, chat, moderation, announcements, and analytics. It coordinates what is live, who is listening, and what messages are being sent.

4. **Streaming Server**  
   A dedicated audio streaming component that reliably delivers low‑latency audio to all listeners. The backend monitors its health and helps DJs handle issues gracefully.

These components are designed to run in the cloud, making it possible to start small on a single server and grow as more listeners and shows are added.

---

## 6. Deployment & Reliability

- **Cloud‑ready:** The system is designed to run on cloud infrastructure, with a separate audio streaming server and application server.
- **Resilience:** If the streaming server has issues, the platform can still keep broadcasts logically running so that DJs don’t lose their scheduled show and can reconnect audio when ready.
- **Security & access control:** User accounts, roles (DJ, moderator, admin), and basic protections against misuse are built into the backend.

For campus IT teams, the goal is to offer a solution that can be hosted in a university’s preferred cloud or on‑premise setup with a clear separation between the application and the streaming layer.

---

## 7. Traction & Validation

- The platform is **already running in a real environment** and has been **tested by actual users** (student DJs and listeners).
- Feedback so far indicates that:
  - DJs value the ability to run shows from anywhere with an internet connection.
  - Listeners appreciate the simplicity of joining via a link instead of tuning to a dedicated FM frequency.
  - Staff see potential for using analytics to inform programming and outreach.

---

## 8. Roadmap (High‑Level)

Planned directions for future development include:

- **Richer analytics:** More detailed insights into listener behavior and show performance.
- **Content extensions:** Options for recorded shows, highlight clips, or integration with podcast feeds (subject to licensing and storage considerations).
- **Deeper campus integrations:** Single sign‑on, course tie‑ins, or event calendar integration where appropriate.
- **Enhanced engagement tools:** Polls, reactions, and richer interactive segments to increase listener participation.

These items build on the existing, working foundation and are intended to strengthen the value proposition for both students and the institution.

---

## 9. Summary

WildCats Radio modernizes campus radio by combining live audio, real‑time interaction, and basic analytics in a single, easy‑to‑use platform.

It is built for:
- **Students**, who gain a professional‑feeling broadcasting tool.
- **Listeners**, who can join from anywhere on web or mobile.
- **Faculty and administrators**, who get visibility, accountability, and a compelling story about student engagement and media literacy.

The system is already live and tested with users, and it is designed to grow into a flagship digital media platform for the campus.
