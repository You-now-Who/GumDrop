const location = "London";
const checkin = "Today";
const nights = "3";

const params = new URLSearchParams({
      loc: location,
      checkin,
      nights
    }).toString();

console.log(params);
