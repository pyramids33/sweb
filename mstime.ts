export default {
    sec: 1000,
    min: 1000*60,
    hour: 1000*60*60,
    day: 1000*60*60*24,
    days (n:number) { return this.day*n },
    hours (n:number) { return this.hour*n },
    mins (n:number) { return this.min*n },
    daysAgo (n:number) { return Date.now() - this.days(n); },
    hoursAgo (n:number) { return Date.now() - this.hours(n); },
    minsAgo (n:number) { return Date.now() - this.mins(n); }
}