import './App.css'

function App() {
  return (
    <div style={{backgroundColor: '#121212', color: 'white', minHeight: '100vh'}}>
      <header style={{padding: '16px', fontWeight: 'bold', fontSize: '28px', borderBottom: '1px solid #2a2a2a'}}>
        GARI.OPROS
        </header>
        <main style={{ padding: '36px', maxWidth: '1200px', margin: '0 auto' }}>
          <section style={{ marginBottom: '48px', backgroundColor: '#40E0D0', padding: '24px', borderRadius: '12px', minHeight: '220px' }}>
          <h1 style={{fontSize: '28px', marginBottom: '8px'}}>
            Добро пожаловать в опросник GARIBOS теперь вы наш босс!!!
             </h1>
             <p style={{color: '#FF69B4'}}>
              Опросник для определения вашего уровня GARIBOS
            </p>
          </section>
          <section style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'}}>
            <article style={{backgroundColor: '#2a2a2a', padding: '24px', borderRadius: '12px', cursor: 'pointer'}}>
              <h2 style={{fontSize: '20px', marginBottom: '8px'}}>Опросник про говно</h2>
              <p style={{color: '#66CDAA', fontSize: '14px'}}>Определите ваш уровень говнокомпотации</p>
            </article>
            <article style={{backgroundColor: '#ADD8E6', padding: '16px', borderRadius: '12px', cursor: 'pointer'}}>
              <h2 style={{fontSize: '20px', marginBottom: '8px'}}>Опросник про попкорн</h2>
              <p style={{color: '#ADFF2F', fontSize: '14px'}}>Определите ваш уровень попкорна</p>
            </article>
              <article
            style={{
              backgroundColor: '#1b1b1b',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Опрос про музыку</h2>
            <p style={{ color: '#aaaaaa', fontSize: '14px' }}>
              Какие жанры вы слушаете чаще всего?
            </p>
          </article>
          <article
            style={{
              backgroundColor: '#1b1b1b',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Опрос про фильмы</h2>
            <p style={{ color: '#aaaaaa', fontSize: '14px' }}>
              Что вы смотрели последним?
            </p>
          </article>
          </section>
        </main>
    </div>
    );
 }
 export default App;
       
