package db

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Init() *pgxpool.Pool {
	var config *pgxpool.Config

	parsedConfig, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalln("Failed to parse DB URL config")
	}

	if os.Getenv("ENVIRONMENT") != "PRODUCTION" {
		if err != nil {
			log.Fatalln("Failed to parse DB URL config")
		}
		parsedConfig.MaxConnLifetime = time.Second * 10
		parsedConfig.MaxConns = 50
	} else {
		if err != nil {
			log.Fatalln("Failed to parse DB URL config")
		}
		parsedConfig.MaxConnLifetime = time.Second * 10
		// heroku addon says 20 maximum connections
		parsedConfig.MaxConns = 20
	}
	config = parsedConfig

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalln("Unable to create pool:", err)
		return nil
	}
	log.Println("Created pool")

	return pool
}
