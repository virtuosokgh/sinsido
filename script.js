// 신시도 좌표: 북위 37.290278°, 동경 126.427778°
const LAT = 37.290278;
const LON = 126.427778;

// 기상청 공공데이터 포털 API 키
const API_KEY = '0DLJ6yf5JtB%2Bcivbpv0WW3MqNT3agDfOu8qHWIE3cS3ti9yWLqpXfo8%2FsUmumDAfiIkFgkk7JB7tQYX7%2Bx3AMw%3D%3D';

// 위경도를 기상청 격자 좌표로 변환
function convertGridCode(lat, lon) {
    const RE = 6371.00877; // 지구 반경(km)
    const GRID = 5.0; // 격자 간격(km)
    const SLAT1 = 30.0; // 투영 위도1(degree)
    const SLAT2 = 60.0; // 투영 위도2(degree)
    const OLON = 126.0; // 기준점 경도(degree)
    const OLAT = 38.0; // 기준점 위도(degree)
    const XO = 43; // 기준점 X좌표(GRID)
    const YO = 136; // 기준점 Y좌표(GRID)
    
    const DEGRAD = Math.PI / 180.0;
    const RADDEG = 180.0 / Math.PI;
    
    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;
    
    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);
    
    let ra = Math.tan(Math.PI * 0.25 + (lat) * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);
    let theta = lon * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;
    
    const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
    const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
    
    return { nx, ny };
}

// 초단기실황용 base_date, base_time 계산 (매시간 정각 발표)
function getUltraSrtDateTime() {
    const now = new Date();
    let date = new Date(now);
    let hour = now.getHours();
    
    // 현재 시간의 정각 시간 사용 (예: 16:30 -> 16:00)
    // 만약 정각이면 현재 시간 사용
    const base_date = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const base_time = String(hour).padStart(2, '0') + '00';
    
    return { base_date, base_time };
}

// 단기예보용 base_date, base_time 계산 (02, 05, 08, 11, 14, 17, 20, 23시 발표)
function getForecastDateTime() {
    const now = new Date();
    let date = new Date(now);
    let hour = now.getHours();
    
    // 단기예보는 02, 05, 08, 11, 14, 17, 20, 23시에 발표
    const forecastTimes = [2, 5, 8, 11, 14, 17, 20, 23];
    let forecastHour = forecastTimes[forecastTimes.length - 1]; // 기본값: 전날 23시
    
    for (let i = forecastTimes.length - 1; i >= 0; i--) {
        if (hour >= forecastTimes[i]) {
            forecastHour = forecastTimes[i];
            break;
        }
    }
    
    // 만약 현재 시간이 02시 이전이면 전날 23시 사용
    if (hour < 2) {
        forecastHour = 23;
        date.setDate(date.getDate() - 1);
    }
    
    const base_date = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const base_time = String(forecastHour).padStart(2, '0') + '00';
    
    return { base_date, base_time };
}

// 날씨 데이터 가져오기
async function fetchWeather() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const weatherContent = document.getElementById('weather-content');
    
    try {
        // 로딩 스피너 표시
        if (loadingSpinner) loadingSpinner.style.display = 'flex';
        if (weatherContent) weatherContent.style.display = 'none';
        
        const grid = convertGridCode(LAT, LON);
        const { base_date: ultra_date, base_time: ultra_time } = getUltraSrtDateTime();
        const { base_date: forecast_date, base_time: forecast_time } = getForecastDateTime();
        
        // API 호출을 병렬로 처리하여 속도 향상
        const ultraUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${API_KEY}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${ultra_date}&base_time=${ultra_time}&nx=${grid.nx}&ny=${grid.ny}`;
        const forecastUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${API_KEY}&pageNo=1&numOfRows=100&dataType=JSON&base_date=${forecast_date}&base_time=${forecast_time}&nx=${grid.nx}&ny=${grid.ny}`;
        
        // 두 API를 병렬로 호출
        const [ultraResponse, forecastResponse] = await Promise.all([
            fetch(ultraUrl),
            fetch(forecastUrl)
        ]);
        
        if (!ultraResponse.ok) {
            throw new Error('날씨 데이터를 가져오는데 실패했습니다.');
        }
        
        const ultraData = await ultraResponse.json();
        
        if (ultraData.response?.header?.resultCode !== '00') {
            const errorMsg = ultraData.response?.header?.resultMsg || 'API 오류';
            throw new Error(errorMsg);
        }
        
        // 초단기실황 데이터 파싱
        const items = ultraData.response?.body?.items?.item || [];
        const weatherData = {};
        
        items.forEach(item => {
            const numValue = parseFloat(item.obsrValue);
            
            // 결측값 필터링
            if (isNaN(numValue) || Math.abs(numValue) >= 998) {
                return;
            }
            
            switch(item.category) {
                case 'T1H': // 기온
                    weatherData.temp = numValue;
                    break;
                case 'REH': // 습도
                    weatherData.humidity = numValue;
                    break;
                case 'WSD': // 풍속
                    weatherData.windSpeed = numValue;
                    break;
                case 'PTY': // 강수형태
                    weatherData.pty = item.obsrValue;
                    break;
                case 'SKY': // 하늘상태
                    weatherData.sky = item.obsrValue;
                    break;
            }
        });
        
        // 단기예보 데이터 파싱 (병렬로 이미 받아온 데이터 사용)
        if (forecastResponse.ok) {
            const forecastData = await forecastResponse.json();
            
            if (forecastData.response?.header?.resultCode === '00') {
                const forecastItems = forecastData.response?.body?.items?.item || [];
                const now = new Date();
                const currentHour = String(now.getHours()).padStart(2, '0') + '00';
                const nextHour = String((now.getHours() + 1) % 24).padStart(2, '0') + '00';
                
                forecastItems.forEach(item => {
                    if (item.fcstTime === currentHour || item.fcstTime === nextHour) {
                        const numValue = parseFloat(item.fcstValue);
                        
                        if (isNaN(numValue) || Math.abs(numValue) >= 998) {
                            return;
                        }
                        
                        if (item.category === 'SKY' && !weatherData.sky) {
                            weatherData.sky = item.fcstValue;
                        }
                        if (item.category === 'PTY' && !weatherData.pty) {
                            weatherData.pty = item.fcstValue;
                        }
                        if (item.category === 'REH' && (!weatherData.humidity || weatherData.humidity < 0)) {
                            weatherData.humidity = numValue;
                        }
                        if (item.category === 'WSD' && (!weatherData.windSpeed || weatherData.windSpeed < 0)) {
                            weatherData.windSpeed = numValue;
                        }
                        if (item.category === 'TMP' && (!weatherData.temp || weatherData.temp < -100)) {
                            weatherData.temp = numValue;
                        }
                    }
                });
            }
        }
        
        // UI 업데이트
        updateWeatherUI(weatherData);
        
        // 로딩 스피너 숨기고 콘텐츠 표시
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (weatherContent) weatherContent.style.display = 'block';
        
    } catch (error) {
        console.error('Error:', error);
        
        // 에러 시에도 로딩 스피너 숨기기
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (weatherContent) {
            weatherContent.style.display = 'block';
            document.getElementById('temp').textContent = '오류';
            document.getElementById('description').textContent = error.message || '날씨 정보를 불러올 수 없습니다.';
        }
    }
}

// 날씨 상태 코드를 텍스트로 변환
function getWeatherDescription(sky, pty) {
    if (pty === '1' || pty === '2' || pty === '4') {
        return '비';
    } else if (pty === '3') {
        return '눈';
    } else if (sky === '1') {
        return '맑음';
    } else if (sky === '3') {
        return '구름많음';
    } else if (sky === '4') {
        return '흐림';
    }
    return '맑음';
}

// 날씨 아이콘 URL 가져오기
function getWeatherIcon(sky, pty) {
    if (pty === '1' || pty === '2' || pty === '4') {
        return 'https://openweathermap.org/img/wn/10d@2x.png';
    } else if (pty === '3') {
        return 'https://openweathermap.org/img/wn/13d@2x.png';
    } else if (sky === '1') {
        return 'https://openweathermap.org/img/wn/01d@2x.png';
    } else if (sky === '3') {
        return 'https://openweathermap.org/img/wn/02d@2x.png';
    } else if (sky === '4') {
        return 'https://openweathermap.org/img/wn/04d@2x.png';
    }
    return 'https://openweathermap.org/img/wn/01d@2x.png';
}

// UI 업데이트
function updateWeatherUI(data) {
    // 온도
    if (data.temp !== undefined) {
        document.getElementById('temp').textContent = Math.round(data.temp);
    } else {
        document.getElementById('temp').textContent = '--';
    }
    
    // 날씨 설명
    const description = getWeatherDescription(data.sky, data.pty);
    document.getElementById('description').textContent = description;
    
    // 날씨 아이콘
    const iconUrl = getWeatherIcon(data.sky, data.pty);
    document.getElementById('weather-icon').src = iconUrl;
    document.getElementById('weather-icon').alt = description;
    
    // 체감온도 (기상청 API에는 체감온도가 없으므로 기온으로 표시)
    if (data.temp !== undefined) {
        document.getElementById('feels-like').textContent = `${Math.round(data.temp)}°C`;
    } else {
        document.getElementById('feels-like').textContent = '--°C';
    }
    
    // 습도
    if (data.humidity !== undefined) {
        document.getElementById('humidity').textContent = `${Math.round(data.humidity)}%`;
    } else {
        document.getElementById('humidity').textContent = '--%';
    }
    
    // 풍속
    if (data.windSpeed !== undefined) {
        document.getElementById('wind-speed').textContent = `${data.windSpeed.toFixed(1)} m/s`;
    } else {
        document.getElementById('wind-speed').textContent = '-- m/s';
    }
    
    // 기압 (기상청 초단기실황에는 기압이 없으므로 --로 표시)
    document.getElementById('pressure').textContent = '-- hPa';
    
    // 업데이트 시간
    const now = new Date();
    const timeString = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('update-time').textContent = `마지막 업데이트: ${timeString}`;
}

// 페이지 로드 시 날씨 정보 가져오기
document.addEventListener('DOMContentLoaded', () => {
    fetchWeather();
    // 10분마다 자동 업데이트
    setInterval(fetchWeather, 600000);
});
