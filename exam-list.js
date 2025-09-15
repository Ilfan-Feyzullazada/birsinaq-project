// exam-list.js üçün tam və düzgün kod

document.addEventListener('DOMContentLoaded', () => {
    // 1. URL-dən lazımi parametrləri (imtahan növü və sinif) götürürük
    const urlParams = new URLSearchParams(window.location.search);
    const examType = urlParams.get('type');
    const examGrade = urlParams.get('grade');

    // 2. Səhifədəki dəyişdiriləcək elementləri seçirik
    const examListContainer = document.querySelector('.exam-list');
    const titleElement = document.getElementById('exam-list-title');

    // 3. Səhifə başlığını dinamik olaraq dəyişirik (məs: "11-ci Sinif üçün Buraxılış İmtahanları")
    if (titleElement && examType && examGrade) {
        titleElement.textContent = `${examGrade} üçün ${examType} İmtahanları`;
    } else if (titleElement) {
        titleElement.textContent = 'Aktiv İmtahanlar';
    }

    // 4. Əgər URL-də lazımi məlumatlar yoxdursa, xəta mesajı göstəririk
    if (!examType || !examGrade) {
        examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahan növü və ya sinif seçilməyib. Zəhmət olmasa, əvvəlki səhifəyə qayıdıb seçim edin.</p>';
        return;
    }

    // 5. Backend-ə sorğu göndərib uyğun imtahanları çəkirik
    fetch(`/api/exams?type=${encodeURIComponent(examType)}&grade=${encodeURIComponent(examGrade)}`, {
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Server cavab vermir və ya xəta baş verdi.');
        }
        return response.json();
    })
    .then(exams => {
        // Mövcud statik imtahanı təmizləyirik
        examListContainer.innerHTML = '';

        if (exams.length === 0) {
            examListContainer.innerHTML = '<p style="text-align: center;">Bu kateqoriya üzrə aktiv imtahan tapılmadı.</p>';
            return;
        }

        // 6. Gələn hər bir imtahan üçün siyahıya yeni element əlavə edirik
        exams.forEach(exam => {
            const examItem = document.createElement('div');
            examItem.className = 'exam-item';

            // Hər bir imtahan üçün düzgün ID və qiymət ilə link yaradırıq
            examItem.innerHTML = `
                <div class="exam-info">
                    <h4>${exam.title}</h4>
                    <p>Təşkilatçı: BirSınaq</p>
                </div>
                <div class="exam-actions">
                    <span class="exam-price">${exam.price.toFixed(2)} AZN</span>
                    <a href="exam-payment.html?examId=${exam.id}&price=${exam.price}" class="payment-btn">İştirak Et</a>
                </div>
            `;
            examListContainer.appendChild(examItem);
        });
    })
    .catch(error => {
        console.error('İmtahanları yükləyərkən xəta:', error);
        examListContainer.innerHTML = '<p style="text-align: center; color: red;">İmtahanları yükləmək mümkün olmadı. Zəhmət olmasa, serverin işlədiyindən əmin olun.</p>';
    });
});