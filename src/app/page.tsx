import styles from './page.module.css';
import UploadArea from '@/components/UploadArea';
import VideoList from '@/components/VideoList';

export default function Home() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
            <path d="M12 10L22 16L12 22V10Z" fill="white" />
          </svg>
          <span>StreamUpload</span>
        </div>
        <nav className={styles.nav}>
          <a href="#" className={styles.navLink}>Videos</a>
          <a href="#" className={styles.navLink}>Dashboard</a>
          <a href="#" className={styles.navLink}>Settings</a>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.uploadSection}>
          <h1 className={styles.title}>Upload Your Video</h1>
          <p className={styles.subtitle}>
            Drag and drop or click to browse. Supports CMAF formats (MP4, MOV, M4V, WebM).
          </p>
          <UploadArea />
        </section>

        <section className={styles.videosSection}>
          <h2 className={styles.sectionTitle}>Your Videos</h2>
          <VideoList />
        </section>
      </main>

      <footer className={styles.footer}>
        <p>&copy; 2024 StreamUpload. All rights reserved.</p>
      </footer>
    </div>
  );
}
