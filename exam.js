// exam.js - Uğursuz ödəniş üçün xəbərdarlıq əlavə edilib

document.addEventListener('DOMContentLoaded', () => {
    
    // ==================================================================
    // YENİ ƏLAVƏ EDİLMİŞ HİSSƏ: Uğursuz ödəniş üçün xəbərdarlıq
    // ==================================================================
    const alertUrlParams = new URLSearchParams(window.location.search);
    const paymentStatus = alertUrlParams.get('payment_status');

    if (paymentStatus === 'failed') {
        alert('Ödəniş uğursuz oldu. Balansınızda kifayət qədər vəsait olduğundan əmin olun və ya başqa kartla cəhd edin.');
        
        // URL-i təmizləyirik ki, səhifə yenilənəndə eyni xəbərdarlıq təkrar çıxmasın
        if (window.history.replaceState) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path: cleanUrl}, '', cleanUrl);
        }
    }
    // ==================================================================
    // YENİ HİSSƏNİN SONU
    // ==================================================================


    // Mövcud kodun olduğu kimi qalır
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