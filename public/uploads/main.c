#include <stdio.h>
#include <stdlib.h>

#include <stdio.h>

int main() {
    int i, j, k,brea;

    for (i = 0; i < 3; i++) {
        for (j = 0; j < 2 * i; j++) {
            printf("*");
        }
        if (i == 3) {
        // You can place the break statement here if needed.
        break;
    }

    for (k = 1; k <= i * 3; k++) {
        printf("*\n"); // Corrected the newline character.
    }
    }

    return 0;
}

