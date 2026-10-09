import styles from "@/styles/overview/scan-results.module.css";

// Stand-in body for result tabs that haven't been built yet.
export default function TabPlaceholder({ title, children }) {
  return (
    <section className={styles.card} aria-labelledby="tab-title">
      <div className={styles.cardHead}>
        <h2 id="tab-title">{title}</h2>
      </div>
      <p className={styles.meta}>{children}</p>
    </section>
  );
}
