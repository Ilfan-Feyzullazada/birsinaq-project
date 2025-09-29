// exam.js - Dinamik olaraq imtahan növlərini və sinifləri backend-dən yükləyir
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.exam-card-container');

    fetch('/api/exams/categories')
        .then(response => response.json())
        .then(categories => {
            container.innerHTML = ''; // Köhnə statik məzmunu təmizlə

            if (Object.keys(categories).length === 0) {
                container.innerHTML = '<p style="text-align:center; font-size: 1.2rem;">Hal-hazırda aktiv imtahan yoxdur.</p>';
                return;
            }

            for (const examType in categories) {
                const grades = categories[examType];
                
                const card = document.createElement('div');
                card.className = 'exam-type-card';

                let gradeButtonsHTML = '';
                grades.forEach(grade => {
                    gradeButtonsHTML += `<button class="grade-btn" data-type="${examType}" data-grade="${grade}">${grade}</button>`;
                });

                card.innerHTML = `
                    <h3>${examType}</h3>
                    <div class="grade-buttons">
                        ${gradeButtonsHTML}
                    </div>
                `;
                container.appendChild(card);
            }
        })
        .catch(error => {
            console.error('Xəta:', error);
            container.innerHTML = '<p style="text-align:center; font-size: 1.2rem; color: red;">İmtahanları yükləmək mümkün olmadı.</p>';
        });

    // Düymə kliklərini idarə etmək üçün event delegation
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('grade-btn')) {
            const examType = e.target.getAttribute('data-type');
            const examGrade = e.target.getAttribute('data-grade');
            window.location.href = `exam-list.html?type=${encodeURIComponent(examType)}&grade=${encodeURIComponent(examGrade)}`;
        }
    });
});