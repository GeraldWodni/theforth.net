: fib ( n1 -- n2 ) recursive
    dup 1 <= if
        drop 1
    else
        1- dup fib swap 1- fib +
    then ;

: fib-test ( n-max -- )
    0 do
        i dec. ." th fib: "
        i fib dec.
        cr
    loop ;

10 fib-test
