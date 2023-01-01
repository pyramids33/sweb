export default {
    sec: 1000,
    min: 1000*60,
    hour: 1000*60*60,
    day: 1000*60*60*24,

    secs (n: number) { return this.sec*n },
    mins (n:number) { return this.min*n },
    hours (n:number) { return this.hour*n },
    days (n:number) { return this.day*n },
    
    secsAgo (n:number) { return Date.now() - this.secs(n); },
    minsAgo (n:number) { return Date.now() - this.mins(n); },
    hoursAgo (n:number) { return Date.now() - this.hours(n); },
    daysAgo (n:number) { return Date.now() - this.days(n); }
    
}