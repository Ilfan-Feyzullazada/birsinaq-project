document.addEventListener('DOMContentLoaded', function() {
    
    // --- Profil məlumatlarını və imtahan keçmişini yükləmə ---
    fetch('http://127.0.0.1:5000/api/profile', {
        credentials: 'include' 
    })
    .then(response => {
        if (!response.ok) {
            window.location.href = 'login.html';
            throw new Error('Giriş edilməyib!');
        }
        return response.json();
    })
    .then(data => {
        // Profil məlumatlarını doldururuq
        document.getElementById('display-name').textContent = data.name;
        document.getElementById('display-contact').textContent = data.contact;
        document.getElementById('display-school').textContent = data.school;
        document.getElementById('display-class').textContent = data.class;
        document.getElementById('display-department').textContent = data.department;
        document.getElementById('display-language').textContent = data.language;

        // --- İmtahan keçmişini dinamik olaraq yaradırıq ---
        const historyList = document.getElementById('exam-history-list');
        historyList.innerHTML = ''; // Köhnə statik siyahını təmizləyirik

        if (data.submission_history && data.submission_history.length > 0) {
            data.submission_history.forEach(submission => {
                const listItem = document.createElement('li');
                // Hər bir imtahan üçün nəticə səhifəsinə link yaradırıq
                listItem.innerHTML = `<a href="result.html?submission_id=${submission.id}">${submission.exam_title} - ${submission.score} bal (${submission.date})</a>`;
                historyList.appendChild(listItem);
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = 'Siz hələ heç bir imtahanda iştirak etməmisiniz.';
            historyList.appendChild(listItem);
        }
        
        // --- Dinamik və Kliklənəbilən Qrafik Funksiyası ---
        const examChartCanvas = document.getElementById('examChart');
        if (examChartCanvas) {
            const ctx = examChartCanvas.getContext('2d');
            
            // Əgər şagirdin imtahan keçmişi varsa, qrafiki qururuq
            if (data.submission_history && data.submission_history.length > 0) {
                
                // 1. Məlumatları hazırlayırıq (qrafikdə soldan sağa doğru zaman axını üçün massivi tərsinə çeviririk)
                const reversedHistory = [...data.submission_history].reverse();
                const examLabels = reversedHistory.map(sub => sub.exam_title); // İmtahan adları
                const examScores = reversedHistory.map(sub => sub.score);      // Toplanan ballar
                const submissionIds = reversedHistory.map(sub => sub.id);       // Hər bir nöqtəyə uyğun nəticə ID-si

                // 2. Qrafiki yaradırıq
                const examChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: examLabels,
                        datasets: [{
                            label: 'Topladığı Bal',
                            data: examScores,
                            backgroundColor: 'rgba(13, 110, 253, 0.2)',
                            borderColor: 'rgba(13, 110, 253, 1)',
                            borderWidth: 2,
                            tension: 0.4,
                            pointBackgroundColor: 'rgba(13, 110, 253, 1)',
                            pointRadius: 5,
                            pointHoverRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { 
                                beginAtZero: true, 
                                max: 700 // Maksimal balı təyin edirik
                            }
                        },
                        // 3. Klik hadisəsini əlavə edirik
                        onClick: (evt) => {
                            const points = examChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);

                            if (points.length) {
                                const firstPoint = points[0];
                                const index = firstPoint.index;
                                const submissionId = submissionIds[index]; // Kliklənən nöqtənin ID-sini götürürük
                                
                                // Nəticə səhifəsinə yönləndiririk
                                window.location.href = `result.html?submission_id=${submissionId}`;
                            }
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: function(context) {
                                        return context[0].label;
                                    },
                                    label: function(context) {
                                        return `Bal: ${context.parsed.y}`;
                                    },
                                    afterLabel: function() {
                                        return 'Nəticəyə baxmaq üçün klikləyin';
                                    }
                                }
                            }
                        }
                    }
                });
            } else {
                // Əgər imtahan keçmişi boşdursa, qrafik yerinə məlumat yazısı göstəririk
                const chartContainer = examChartCanvas.parentElement;
                chartContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Statistika üçün kifayət qədər imtahan nəticəsi yoxdur.</p>';
            }
        }
    })
    .catch(error => {
        console.error('Xəta:', error.message);
    });

    // --- Akkordeon Funksiyası ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const icon = header.querySelector('i');
            
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                content.style.padding = "0 20px";
                icon.style.transform = 'rotate(0deg)';
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                content.style.padding = "20px";
                icon.style.transform = 'rotate(180deg)';
            }
        });
    });

    // --- Profil Məlumatlarını Dəyişdirmə Funksiyası ---
    // Bu hissə dəyişməz qalıb
});