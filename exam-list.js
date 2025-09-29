// exam-list.js faylının YENİ və DÜZGÜN versiyası

document.addEventListener('DOMContentLoaded', () => {
    const examListContainer = document.querySelector('.exam-list');
    const titleElement = document.getElementById('exam-list-title');
    const urlParams = new URLSearchParams(window.location.search);
    const examType = urlParams.get('type');
    const examGrade = urlParams.get('grade');

    if (titleElement) {
        titleElement.textContent = examGrade && examType ? `${examGrade} üçün ${examType} İmtahanları` : 'Aktiv İmtahanlar';
    }

    if (!examType || !examGrade) {
        examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahan növü və ya sinif seçilməyib.</p>';
        return;
    }

    // `credentials: 'include'` əlavə etdik ki, login məlumatları da getsin
    fetch(`/api/exams?type=${encodeURIComponent(examType)}&grade=${encodeURIComponent(examGrade)}`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server cavab vermir');
            }
            return response.json();
        })
        .then(exams => {
            examListContainer.innerHTML = '';
            if (exams.length === 0) {
                examListContainer.innerHTML = '<p style="text-align: center;">Bu kateqoriya üzrə aktiv imtahan tapılmadı.</p>';
                return;
            }

            exams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';

                let actionHTML;
                const priceText = exam.price > 0 ? `${exam.price.toFixed(2)} AZN` : 'Pulsuz';

                if (exam.is_taken) {
                    // Əgər istifadəçi artıq imtahanı veribsə
                    actionHTML = `<a href="result.html?submission_id=${exam.submission_id}" class="result-btn">Nəticəyə Bax</a>`;
                } else if (exam.price <= 0) {
                    // Əgər imtahan pulsuzdursa
                    actionHTML = `<a href="exam-test.html?examId=${exam.id}" class="participate-btn">İştirak Et</a>`;
                } else {
                    // Əgər imtahan ödənişlidirsə, ödəniş səhifəsinə yönləndiririk
                    actionHTML = `<a href="exam-payment.html?examId=${exam.id}&price=${exam.price}" class="payment-btn">İştirak Et</a>`;
                }

                examItem.innerHTML = `
                    <div class="exam-info">
                        <h4>${exam.title}</h4>
                        <p>Təşkilatçı: BirSınaq</p>
                    </div>
                    <div class="exam-actions">
                        <span class="exam-price">${priceText}</span>
                        ${actionHTML}
                    </div>
                `;
                examListContainer.appendChild(examItem);
            });
        })
        .catch(error => {
            console.error('İmtahanları yükləyərkən xəta:', error);
            examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahanları yükləmək mümkün olmadı.</p>';
        });
    
    // Artıq burada 'click' listener-ə ehtiyac yoxdur, çünki linklər birbaşa düzgün ünvana aparır.
    // Ona görə köhnə container.addEventListener bloku tamamilə silindi.
});