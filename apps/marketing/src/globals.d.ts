// Ambient declarations for CSS side-effect imports.
// The Next.js project-wide CSS support handles bundling, but our tsconfig
// types array doesn't pull in `react`/`react-dom` like the other portals,
// so TypeScript can't find `*.css` module declarations from there.
declare module '*.css';
